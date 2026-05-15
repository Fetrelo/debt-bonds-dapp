import { BN } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { SigningWallet } from "../wallet.js";
import {
  findBondConfigPda,
  findEscrowPda,
  findListingPda,
  getProgram,
  PROGRAM_ID,
} from "./client.js";
import { sendWithSimulation } from "./tx.js";

export type SetupBondMarketParams = {
  nominalValue: number;
  interestRatePct: number;
  durationYears: number;
  paymentMint: PublicKey;
  unitPrice: BN;
  initialSupply: BN;
};

export type SetupBondMarketResult = {
  bondMint: string;
  bondConfigPda: string;
  listingPda: string;
  escrow: string;
  signatures: string[];
};

export async function setupBondMarket(
  connection: Connection,
  wallet: SigningWallet,
  params: SetupBondMarketParams,
): Promise<SetupBondMarketResult> {
  const programAccount = await connection.getAccountInfo(PROGRAM_ID);
  if (!programAccount?.executable) {
    throw new Error(
      `Debt-bonds program is not deployed at ${PROGRAM_ID.toBase58()}. Run \`anchor deploy\` first.`,
    );
  }

  const mintKeypair = Keypair.generate();
  const bondMint = mintKeypair.publicKey;
  const [bondConfig] = findBondConfigPda(bondMint);
  const [listing] = findListingPda(bondMint);
  const [escrow] = findEscrowPda(bondMint);

  const interestRateBps = params.interestRatePct * 100;
  const program = getProgram(connection, wallet);

  const createIx = await program.methods
    .createBond(
      new BN(params.nominalValue),
      interestRateBps,
      params.durationYears,
    )
    .accountsPartial({
      issuer: wallet.publicKey,
      bondMint,
      bondConfig,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  const initListingIx = await program.methods
    .initListing(params.unitPrice)
    .accountsPartial({
      issuer: wallet.publicKey,
      bondMint,
      paymentMint: params.paymentMint,
      bondConfig,
      listing,
      escrow,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction();

  const addSupplyIx = await program.methods
    .addSupplyToListing(params.initialSupply)
    .accountsPartial({
      issuer: wallet.publicKey,
      bondMint,
      bondConfig,
      listing,
      escrow,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  const tx = new Transaction().add(createIx, initListingIx, addSupplyIx);
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  const signature = await sendWithSimulation(
    connection,
    wallet,
    tx,
    [mintKeypair],
    latestBlockhash,
  );

  return {
    bondMint: bondMint.toBase58(),
    bondConfigPda: bondConfig.toBase58(),
    listingPda: listing.toBase58(),
    escrow: escrow.toBase58(),
    signatures: [signature],
  };
}
