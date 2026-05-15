use anchor_lang::prelude::*;

declare_id!("FvpkHjRckVSJiBurrxj3gkJAK67jivvGfffvs9Xn7rnm");

#[program]
pub mod debt_bonds {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
