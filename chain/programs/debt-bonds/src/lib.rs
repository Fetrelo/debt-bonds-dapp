//! Debt Bonds Anchor program.
//!
//! Design notes (chosen with the user):
//! - Bond decimals are fixed to 0 (whole bonds).
//! - The program owns the bond mint's mint authority forever (`mint_more` model).
//!   Supply only exists as the issuer tops up the listing.
//! - `nominal_value` is an abstract integer ("dollar-like" unit). Coupon
//!   amounts are computed in the same abstract unit and converted to a
//!   payment mint's atomic units at pay time, so the issuer can pick a
//!   different coin per coupon payout. `coupons_paid` on `Holder` is tracked
//!   in the abstract unit too.
//! - One listing per bond. Statuses: Active / SoldOut / Closed (terminal).
//!   SoldOut auto-flips back to Active when issuer tops up.

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{
    self, set_authority, spl_token::instruction::AuthorityType, InitializeMint2, Mint,
    MintTo, SetAuthority, Token, TokenAccount, Transfer,
};

declare_id!("FvpkHjRckVSJiBurrxj3gkJAK67jivvGfffvs9Xn7rnm");

pub const BOND_CONFIG_SEED: &[u8] = b"bond_config";
pub const LISTING_SEED: &[u8] = b"listing";
pub const HOLDER_SEED: &[u8] = b"holder";
pub const ESCROW_SEED: &[u8] = b"listing_escrow";

#[program]
pub mod debt_bonds {
    use super::*;

    /// Creates a brand-new bond: initializes the SPL mint with decimals=0,
    /// sets `BondConfig` PDA as the mint authority (freeze authority left
    /// unset), and records bond terms.
    pub fn create_bond(
        ctx: Context<CreateBond>,
        nominal_value: u64,
        interest_rate_bps: u16,
        duration_years: u8,
    ) -> Result<()> {
        require!(nominal_value > 0, BondError::InvalidNominalValue);
        require!(interest_rate_bps > 0, BondError::InvalidInterestRate);
        require!(duration_years > 0, BondError::InvalidDuration);

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            InitializeMint2 {
                mint: ctx.accounts.bond_mint.to_account_info(),
            },
        );
        token::initialize_mint2(
            cpi_ctx,
            0,
            &ctx.accounts.bond_config.key(),
            None,
        )?;

        let config = &mut ctx.accounts.bond_config;
        config.mint = ctx.accounts.bond_mint.key();
        config.issuer = ctx.accounts.issuer.key();
        config.nominal_value = nominal_value;
        config.interest_rate_bps = interest_rate_bps;
        config.duration_years = duration_years;
        config.created_at = Clock::get()?.unix_timestamp;
        config.bump = ctx.bumps.bond_config;
        Ok(())
    }

    /// Migration path for bonds whose SPL mint was created BEFORE this
    /// feature shipped. The current mint authority (the issuer) signs to
    /// hand mint authority over to the `BondConfig` PDA.
    pub fn register_bond(
        ctx: Context<RegisterBond>,
        nominal_value: u64,
        interest_rate_bps: u16,
        duration_years: u8,
    ) -> Result<()> {
        require!(nominal_value > 0, BondError::InvalidNominalValue);
        require!(interest_rate_bps > 0, BondError::InvalidInterestRate);
        require!(duration_years > 0, BondError::InvalidDuration);

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            SetAuthority {
                current_authority: ctx.accounts.issuer.to_account_info(),
                account_or_mint: ctx.accounts.bond_mint.to_account_info(),
            },
        );
        set_authority(
            cpi_ctx,
            AuthorityType::MintTokens,
            Some(ctx.accounts.bond_config.key()),
        )?;

        let config = &mut ctx.accounts.bond_config;
        config.mint = ctx.accounts.bond_mint.key();
        config.issuer = ctx.accounts.issuer.key();
        config.nominal_value = nominal_value;
        config.interest_rate_bps = interest_rate_bps;
        config.duration_years = duration_years;
        config.created_at = Clock::get()?.unix_timestamp;
        config.bump = ctx.bumps.bond_config;
        Ok(())
    }

    /// Opens a single listing for the bond with a given payment coin and
    /// per-bond unit price. Creates the escrow token account that holds
    /// available-to-purchase bonds.
    pub fn init_listing(
        ctx: Context<InitListing>,
        unit_price: u64,
    ) -> Result<()> {
        require!(unit_price > 0, BondError::InvalidPrice);

        let listing = &mut ctx.accounts.listing;
        listing.bond_mint = ctx.accounts.bond_mint.key();
        listing.payment_mint = ctx.accounts.payment_mint.key();
        listing.unit_price = unit_price;
        listing.available = 0;
        listing.total_sold = 0;
        listing.status = ListingStatus::Active as u8;
        listing.escrow = ctx.accounts.escrow.key();
        listing.bump = ctx.bumps.listing;
        Ok(())
    }

    /// Issuer mints `amount` new bond tokens straight into the escrow,
    /// increasing the available-to-purchase supply.
    pub fn add_supply_to_listing(
        ctx: Context<AddSupplyToListing>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, BondError::InvalidAmount);
        require!(
            ctx.accounts.listing.status != ListingStatus::Closed as u8,
            BondError::ListingClosed
        );

        let mint_key = ctx.accounts.bond_mint.key();
        let bump = ctx.accounts.bond_config.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[BOND_CONFIG_SEED, mint_key.as_ref(), &[bump]]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.bond_mint.to_account_info(),
                to: ctx.accounts.escrow.to_account_info(),
                authority: ctx.accounts.bond_config.to_account_info(),
            },
            signer_seeds,
        );
        token::mint_to(cpi_ctx, amount)?;

        let listing = &mut ctx.accounts.listing;
        listing.available = listing
            .available
            .checked_add(amount)
            .ok_or(BondError::MathOverflow)?;
        if listing.status == ListingStatus::SoldOut as u8 {
            listing.status = ListingStatus::Active as u8;
        }
        Ok(())
    }

    /// Terminal close. Available bonds remain in escrow and stop being
    /// purchasable. (Re-opening a closed listing is intentionally
    /// unsupported.)
    pub fn close_listing(ctx: Context<CloseListing>) -> Result<()> {
        let listing = &mut ctx.accounts.listing;
        require!(
            listing.status != ListingStatus::Closed as u8,
            BondError::ListingClosed
        );
        listing.status = ListingStatus::Closed as u8;
        Ok(())
    }

    /// A non-issuer buys `amount` bonds. Pays `amount * unit_price` of the
    /// listing's `payment_mint` directly to the issuer's ATA; receives
    /// `amount` bond tokens out of escrow; updates / creates a `Holder`
    /// PDA tracking how many bonds they hold and how much coupon was paid.
    pub fn purchase_bond(ctx: Context<PurchaseBond>, amount: u64) -> Result<()> {
        require!(amount > 0, BondError::InvalidAmount);
        let listing = &ctx.accounts.listing;
        require!(
            listing.status == ListingStatus::Active as u8,
            BondError::ListingNotActive
        );
        require!(amount <= listing.available, BondError::InsufficientAvailable);
        require!(
            ctx.accounts.buyer.key() != ctx.accounts.bond_config.issuer,
            BondError::IssuerCannotBuy
        );

        let total_payment = listing
            .unit_price
            .checked_mul(amount)
            .ok_or(BondError::MathOverflow)?;

        let pay_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.buyer_payment_ata.to_account_info(),
                to: ctx.accounts.issuer_payment_ata.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            },
        );
        token::transfer(pay_ctx, total_payment)?;

        let mint_key = ctx.accounts.bond_mint.key();
        let listing_bump = listing.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[LISTING_SEED, mint_key.as_ref(), &[listing_bump]]];
        let bond_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow.to_account_info(),
                to: ctx.accounts.buyer_bond_ata.to_account_info(),
                authority: ctx.accounts.listing.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(bond_ctx, amount)?;

        let holder = &mut ctx.accounts.holder;
        if holder.bond_mint == Pubkey::default() {
            holder.bond_mint = mint_key;
            holder.owner = ctx.accounts.buyer.key();
            holder.bonds_held = 0;
            holder.coupons_paid = 0;
            holder.bump = ctx.bumps.holder;
        }
        holder.bonds_held = holder
            .bonds_held
            .checked_add(amount)
            .ok_or(BondError::MathOverflow)?;

        let listing = &mut ctx.accounts.listing;
        listing.available = listing
            .available
            .checked_sub(amount)
            .ok_or(BondError::MathOverflow)?;
        listing.total_sold = listing
            .total_sold
            .checked_add(amount)
            .ok_or(BondError::MathOverflow)?;
        if listing.available == 0 {
            listing.status = ListingStatus::SoldOut as u8;
        }
        Ok(())
    }

    /// Issuer pays whatever coupon a holder is still owed, in a coin of
    /// the issuer's choosing. The owed amount is computed in abstract
    /// units (`nominal_value * rate_bps / 10_000 * duration_years *
    /// bonds_held - coupons_paid`) and scaled to the chosen payment
    /// mint's decimals. The client calls this once per holder per tx (or
    /// batches several invocations into a single tx).
    pub fn pay_holder_coupons(ctx: Context<PayHolderCoupons>) -> Result<()> {
        let config = &ctx.accounts.bond_config;
        let holder = &mut ctx.accounts.holder;
        require!(holder.bonds_held > 0, BondError::HolderHasNoBonds);

        // total_owed_abstract = nominal × rate_bps × duration × bonds_held / 10_000
        let total_owed = (config.nominal_value as u128)
            .checked_mul(config.interest_rate_bps as u128)
            .and_then(|v| v.checked_mul(config.duration_years as u128))
            .and_then(|v| v.checked_mul(holder.bonds_held as u128))
            .and_then(|v| v.checked_div(10_000u128))
            .ok_or(BondError::MathOverflow)?;
        let total_owed_u64 =
            u64::try_from(total_owed).map_err(|_| BondError::MathOverflow)?;

        let pending = total_owed_u64
            .checked_sub(holder.coupons_paid)
            .ok_or(BondError::CouponOverpaid)?;
        require!(pending > 0, BondError::NoCouponPending);

        let decimals = ctx.accounts.payment_mint.decimals as u32;
        let scale = 10u128
            .checked_pow(decimals)
            .ok_or(BondError::MathOverflow)?;
        let amount_atomic = (pending as u128)
            .checked_mul(scale)
            .ok_or(BondError::MathOverflow)?;
        let amount_atomic =
            u64::try_from(amount_atomic).map_err(|_| BondError::MathOverflow)?;

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.issuer_payment_ata.to_account_info(),
                to: ctx.accounts.holder_payment_ata.to_account_info(),
                authority: ctx.accounts.issuer.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, amount_atomic)?;

        holder.coupons_paid = holder
            .coupons_paid
            .checked_add(pending)
            .ok_or(BondError::MathOverflow)?;
        Ok(())
    }
}

// ============================================================================
// State accounts
// ============================================================================

#[account]
pub struct BondConfig {
    pub mint: Pubkey,
    pub issuer: Pubkey,
    pub nominal_value: u64,
    pub interest_rate_bps: u16,
    pub duration_years: u8,
    pub created_at: i64,
    pub bump: u8,
}

impl BondConfig {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 2 + 1 + 8 + 1;
}

#[account]
pub struct Listing {
    pub bond_mint: Pubkey,
    pub payment_mint: Pubkey,
    pub unit_price: u64,
    pub available: u64,
    pub total_sold: u64,
    pub status: u8,
    pub escrow: Pubkey,
    pub bump: u8,
}

impl Listing {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 1 + 32 + 1;
}

#[account]
pub struct Holder {
    pub bond_mint: Pubkey,
    pub owner: Pubkey,
    pub bonds_held: u64,
    pub coupons_paid: u64,
    pub bump: u8,
}

impl Holder {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 1;
}

#[repr(u8)]
pub enum ListingStatus {
    Active = 0,
    SoldOut = 1,
    Closed = 2,
}

// ============================================================================
// Account contexts
// ============================================================================

#[derive(Accounts)]
pub struct CreateBond<'info> {
    #[account(mut)]
    pub issuer: Signer<'info>,

    #[account(
        init,
        payer = issuer,
        mint::decimals = 0,
        mint::authority = bond_config,
    )]
    pub bond_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = issuer,
        space = BondConfig::SPACE,
        seeds = [BOND_CONFIG_SEED, bond_mint.key().as_ref()],
        bump,
    )]
    pub bond_config: Account<'info, BondConfig>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct RegisterBond<'info> {
    #[account(mut)]
    pub issuer: Signer<'info>,

    /// CHECK: mint authority transfer is validated by the SPL token program.
    #[account(mut)]
    pub bond_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = issuer,
        space = BondConfig::SPACE,
        seeds = [BOND_CONFIG_SEED, bond_mint.key().as_ref()],
        bump,
    )]
    pub bond_config: Account<'info, BondConfig>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct InitListing<'info> {
    #[account(mut)]
    pub issuer: Signer<'info>,

    pub bond_mint: Account<'info, Mint>,
    pub payment_mint: Account<'info, Mint>,

    #[account(
        seeds = [BOND_CONFIG_SEED, bond_mint.key().as_ref()],
        bump = bond_config.bump,
        has_one = issuer @ BondError::NotIssuer,
    )]
    pub bond_config: Account<'info, BondConfig>,

    #[account(
        init,
        payer = issuer,
        space = Listing::SPACE,
        seeds = [LISTING_SEED, bond_mint.key().as_ref()],
        bump,
    )]
    pub listing: Account<'info, Listing>,

    #[account(
        init,
        payer = issuer,
        seeds = [ESCROW_SEED, bond_mint.key().as_ref()],
        bump,
        token::mint = bond_mint,
        token::authority = listing,
    )]
    pub escrow: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AddSupplyToListing<'info> {
    pub issuer: Signer<'info>,

    #[account(mut)]
    pub bond_mint: Account<'info, Mint>,

    #[account(
        seeds = [BOND_CONFIG_SEED, bond_mint.key().as_ref()],
        bump = bond_config.bump,
        has_one = issuer @ BondError::NotIssuer,
    )]
    pub bond_config: Account<'info, BondConfig>,

    #[account(
        mut,
        seeds = [LISTING_SEED, bond_mint.key().as_ref()],
        bump = listing.bump,
    )]
    pub listing: Account<'info, Listing>,

    #[account(
        mut,
        seeds = [ESCROW_SEED, bond_mint.key().as_ref()],
        bump,
        token::mint = bond_mint,
        token::authority = listing,
    )]
    pub escrow: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CloseListing<'info> {
    pub issuer: Signer<'info>,

    pub bond_mint: Account<'info, Mint>,

    #[account(
        seeds = [BOND_CONFIG_SEED, bond_mint.key().as_ref()],
        bump = bond_config.bump,
        has_one = issuer @ BondError::NotIssuer,
    )]
    pub bond_config: Account<'info, BondConfig>,

    #[account(
        mut,
        seeds = [LISTING_SEED, bond_mint.key().as_ref()],
        bump = listing.bump,
    )]
    pub listing: Account<'info, Listing>,
}

#[derive(Accounts)]
pub struct PurchaseBond<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(mut)]
    pub bond_mint: Box<Account<'info, Mint>>,
    pub payment_mint: Box<Account<'info, Mint>>,

    #[account(
        seeds = [BOND_CONFIG_SEED, bond_mint.key().as_ref()],
        bump = bond_config.bump,
    )]
    pub bond_config: Box<Account<'info, BondConfig>>,

    #[account(
        mut,
        seeds = [LISTING_SEED, bond_mint.key().as_ref()],
        bump = listing.bump,
        constraint = listing.payment_mint == payment_mint.key() @ BondError::PaymentMintMismatch,
    )]
    pub listing: Box<Account<'info, Listing>>,

    #[account(
        mut,
        seeds = [ESCROW_SEED, bond_mint.key().as_ref()],
        bump,
        token::mint = bond_mint,
        token::authority = listing,
    )]
    pub escrow: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = buyer,
        space = Holder::SPACE,
        seeds = [HOLDER_SEED, bond_mint.key().as_ref(), buyer.key().as_ref()],
        bump,
    )]
    pub holder: Box<Account<'info, Holder>>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = bond_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_bond_ata: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = payment_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_payment_ata: Box<Account<'info, TokenAccount>>,

    /// CHECK: the issuer key is validated against `bond_config.issuer`.
    #[account(address = bond_config.issuer)]
    pub issuer: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = payment_mint,
        associated_token::authority = issuer,
    )]
    pub issuer_payment_ata: Box<Account<'info, TokenAccount>>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct PayHolderCoupons<'info> {
    #[account(mut)]
    pub issuer: Signer<'info>,

    pub bond_mint: Account<'info, Mint>,
    pub payment_mint: Account<'info, Mint>,

    #[account(
        seeds = [BOND_CONFIG_SEED, bond_mint.key().as_ref()],
        bump = bond_config.bump,
        has_one = issuer @ BondError::NotIssuer,
    )]
    pub bond_config: Account<'info, BondConfig>,

    #[account(
        mut,
        seeds = [HOLDER_SEED, bond_mint.key().as_ref(), holder.owner.as_ref()],
        bump = holder.bump,
    )]
    pub holder: Account<'info, Holder>,

    #[account(
        mut,
        associated_token::mint = payment_mint,
        associated_token::authority = issuer,
    )]
    pub issuer_payment_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = payment_mint,
        associated_token::authority = holder.owner,
    )]
    pub holder_payment_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum BondError {
    #[msg("Nominal value must be greater than zero.")]
    InvalidNominalValue,
    #[msg("Interest rate must be greater than zero.")]
    InvalidInterestRate,
    #[msg("Duration must be at least one year.")]
    InvalidDuration,
    #[msg("Price must be greater than zero.")]
    InvalidPrice,
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Listing is closed.")]
    ListingClosed,
    #[msg("Listing is not active.")]
    ListingNotActive,
    #[msg("Not enough bonds available in the listing.")]
    InsufficientAvailable,
    #[msg("Signer is not the bond issuer.")]
    NotIssuer,
    #[msg("Issuer cannot buy their own bonds.")]
    IssuerCannotBuy,
    #[msg("Payment mint does not match the listing's payment mint.")]
    PaymentMintMismatch,
    #[msg("Holder has no bonds.")]
    HolderHasNoBonds,
    #[msg("Holder is already fully paid (would overpay).")]
    CouponOverpaid,
    #[msg("No coupon pending for this holder.")]
    NoCouponPending,
    #[msg("Math overflow.")]
    MathOverflow,
}
