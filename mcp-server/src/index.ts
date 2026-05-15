#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BN } from "@coral-xyz/anchor";
import { z } from "zod";
import {
  getConnection,
  getOptionalSigningWallet,
  getSigningWalletOrThrow,
} from "./config.js";
import { setupBondMarket } from "./solana/setupMarket.js";
import { purchaseBond } from "./solana/bondActions.js";
import { transferBondSpl } from "./solana/transfers.js";
import {
  fetchBondWalletBalance,
  fetchHolder,
  fetchStablecoinBalance,
  getBondSummary,
  listBondHolders,
  listBondsByIssuer,
} from "./solana/queries.js";
import { findHolderPda } from "./solana/client.js";
import { jsonText, parsePubkey } from "./util.js";

const server = new McpServer({
  name: "debt-bonds",
  version: "0.1.0",
});

const pubkeySchema = z.string().describe("Solana public key (base58)");

server.tool(
  "setup_bond_market",
  "Create a new debt bond mint, open its listing, and mint initial supply into escrow in one transaction. Requires SOLANA_KEYPAIR_PATH (issuer wallet). unit_price is in payment_mint atomic units per whole bond.",
  {
    nominal_value: z.number().int().positive(),
    interest_rate_pct: z.number().int().min(1).max(655),
    duration_years: z.number().int().min(1).max(255),
    payment_mint: pubkeySchema,
    unit_price: z
      .string()
      .or(z.number())
      .describe("Per-bond price in payment_mint atomic units"),
    initial_supply: z
      .number()
      .int()
      .positive()
      .describe("Whole bonds minted into escrow"),
  },
  async (args) => {
    const connection = getConnection();
    const wallet = getSigningWalletOrThrow();
    const result = await setupBondMarket(connection, wallet, {
      nominalValue: args.nominal_value,
      interestRatePct: args.interest_rate_pct,
      durationYears: args.duration_years,
      paymentMint: parsePubkey(args.payment_mint, "payment_mint"),
      unitPrice: new BN(String(args.unit_price)),
      initialSupply: new BN(args.initial_supply),
    });
    return jsonText(result);
  },
);

server.tool(
  "purchase_bond",
  "Purchase whole bonds from the active listing. Buyer is SOLANA_KEYPAIR_PATH wallet. Pays unit_price * amount in the listing payment mint.",
  {
    bond_mint: pubkeySchema,
    amount: z.number().int().positive().describe("Whole bonds to buy"),
  },
  async (args) => {
    const connection = getConnection();
    const wallet = getSigningWalletOrThrow();
    const bondMint = parsePubkey(args.bond_mint, "bond_mint");
    const summary = await getBondSummary(connection, bondMint);
    if (!summary.config || !summary.listing) {
      throw new Error("Bond config or listing not found on-chain.");
    }
    if (summary.listing.status !== 0) {
      throw new Error(`Listing is not active (status: ${summary.listing.statusLabel}).`);
    }
    const signature = await purchaseBond(connection, wallet, {
      bondMint,
      paymentMint: parsePubkey(summary.listing.paymentMint, "payment_mint"),
      issuer: parsePubkey(summary.config.issuer, "issuer"),
      amount: new BN(args.amount),
    });
    const [holderPda] = findHolderPda(bondMint, wallet.publicKey);
    return jsonText({ signature, holder_pda: holderPda.toBase58() });
  },
);

server.tool(
  "transfer_bond_spl",
  "Transfer bond SPL tokens to another wallet. WARNING: This only moves tokens; the on-chain Holder PDA and coupon rights stay with the original purchaser until a program transfer instruction exists (Phase 2).",
  {
    bond_mint: pubkeySchema,
    recipient: pubkeySchema,
    amount: z.number().int().positive().describe("Whole bonds (decimals=0)"),
  },
  async (args) => {
    const connection = getConnection();
    const wallet = getSigningWalletOrThrow();
    const signature = await transferBondSpl(connection, wallet, {
      bondMint: parsePubkey(args.bond_mint, "bond_mint"),
      recipient: parsePubkey(args.recipient, "recipient"),
      amount: BigInt(args.amount),
    });
    return jsonText({
      signature,
      note: "SPL transfer only; Holder PDA unchanged.",
    });
  },
);

server.tool(
  "get_bond",
  "Fetch BondConfig and Listing for a bond mint (read-only).",
  { bond_mint: pubkeySchema },
  async (args) => {
    const connection = getConnection();
    const bondMint = parsePubkey(args.bond_mint, "bond_mint");
    const data = await getBondSummary(connection, bondMint);
    return jsonText(data);
  },
);

server.tool(
  "get_holder",
  "Fetch the Holder PDA for a bond mint and owner (coupon accounting). Defaults owner to SOLANA_KEYPAIR_PATH when set.",
  {
    bond_mint: pubkeySchema,
    owner: pubkeySchema.optional(),
  },
  async (args) => {
    const connection = getConnection();
    const bondMint = parsePubkey(args.bond_mint, "bond_mint");
    const owner = args.owner
      ? parsePubkey(args.owner, "owner")
      : getOptionalSigningWallet()?.publicKey;
    if (!owner) {
      throw new Error("Provide owner or set SOLANA_KEYPAIR_PATH.");
    }
    const holder = await fetchHolder(connection, bondMint, owner);
    return jsonText({ owner: owner.toBase58(), holder });
  },
);

server.tool(
  "list_bond_holders",
  "List all Holder PDAs for a bond mint (read-only).",
  { bond_mint: pubkeySchema },
  async (args) => {
    const connection = getConnection();
    const bondMint = parsePubkey(args.bond_mint, "bond_mint");
    const holders = await listBondHolders(connection, bondMint);
    return jsonText({ count: holders.length, holders });
  },
);

server.tool(
  "get_bond_wallet_balance",
  "SPL ATA balance and Holder PDA bonds_held for comparison (useful after SPL-only transfers).",
  {
    bond_mint: pubkeySchema,
    owner: pubkeySchema.optional(),
  },
  async (args) => {
    const connection = getConnection();
    const bondMint = parsePubkey(args.bond_mint, "bond_mint");
    const owner = args.owner
      ? parsePubkey(args.owner, "owner")
      : getOptionalSigningWallet()?.publicKey;
    if (!owner) {
      throw new Error("Provide owner or set SOLANA_KEYPAIR_PATH.");
    }
    const [spl, holder] = await Promise.all([
      fetchBondWalletBalance(connection, bondMint, owner),
      fetchHolder(connection, bondMint, owner),
    ]);
    return jsonText({
      owner: owner.toBase58(),
      spl_wallet_balance: spl,
      holder_pda: holder,
      holder_may_differ_from_spl:
        holder !== null && holder.bondsHeld !== spl.balance,
    });
  },
);

server.tool(
  "list_bonds_by_issuer",
  "List BondConfig PDAs created by an issuer. Defaults to SOLANA_KEYPAIR_PATH when set.",
  { issuer: pubkeySchema.optional() },
  async (args) => {
    const connection = getConnection();
    const issuer = args.issuer
      ? parsePubkey(args.issuer, "issuer")
      : getOptionalSigningWallet()?.publicKey;
    if (!issuer) {
      throw new Error("Provide issuer or set SOLANA_KEYPAIR_PATH.");
    }
    const bonds = await listBondsByIssuer(connection, issuer);
    return jsonText({ issuer: issuer.toBase58(), count: bonds.length, bonds });
  },
);

server.tool(
  "get_stablecoin_balance",
  "Read SPL token balance for a mint and owner (e.g. stablecoin). Defaults owner to SOLANA_KEYPAIR_PATH when set.",
  {
    mint: pubkeySchema,
    owner: pubkeySchema.optional(),
  },
  async (args) => {
    const connection = getConnection();
    const mint = parsePubkey(args.mint, "mint");
    const owner = args.owner
      ? parsePubkey(args.owner, "owner")
      : getOptionalSigningWallet()?.publicKey;
    if (!owner) {
      throw new Error("Provide owner or set SOLANA_KEYPAIR_PATH.");
    }
    const balance = await fetchStablecoinBalance(connection, mint, owner);
    return jsonText({ mint: mint.toBase58(), owner: owner.toBase58(), ...balance });
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
