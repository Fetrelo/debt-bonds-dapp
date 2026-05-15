import { BN } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionSignature,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { SigningWallet } from "../wallet.js";
import {
  PROGRAM_ID,
  findBondConfigPda,
  getProgram,
} from "./client.js";
import { sendWithSimulation } from "./tx.js";

export type CreateBondParams = {
  nominalValue: number;
  interestRatePct: number;
  durationYears: number;
};

export type CreateBondResult = {
  mint: PublicKey;
  bondConfig: PublicKey;
  signature: TransactionSignature;
};

export async function createBondToken(
  connection: Connection,
  wallet: SigningWallet,
  { nominalValue, interestRatePct, durationYears }: CreateBondParams,
): Promise<CreateBondResult> {
  if (!Number.isInteger(nominalValue) || nominalValue <= 0) {
    throw new Error("Nominal value must be a positive whole number.");
  }
  if (
    !Number.isInteger(interestRatePct) ||
    interestRatePct <= 0 ||
    interestRatePct > 655
  ) {
    throw new Error("Interest rate must be a whole percent between 1 and 655.");
  }
  if (
    !Number.isInteger(durationYears) ||
    durationYears <= 0 ||
    durationYears > 255
  ) {
    throw new Error("Duration must be a whole number of years (1–255).");
  }

  const programAccount = await connection.getAccountInfo(PROGRAM_ID);
  if (!programAccount?.executable) {
    throw new Error(
      `Debt-bonds program is not deployed at ${PROGRAM_ID.toBase58()} on this cluster. Run \`anchor deploy\` first.`,
    );
  }

  const program = getProgram(connection, wallet);
  const mintKeypair = Keypair.generate();
  const [bondConfig] = findBondConfigPda(mintKeypair.publicKey);
  const interestRateBps = interestRatePct * 100;

  const ix = await program.methods
    .createBond(new BN(nominalValue), interestRateBps, durationYears)
    .accountsPartial({
      issuer: wallet.publicKey,
      bondMint: mintKeypair.publicKey,
      bondConfig,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  const tx = new Transaction().add(ix);
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  const signature = await sendWithSimulation(
    connection,
    wallet,
    tx,
    [mintKeypair],
    latestBlockhash,
  );

  return { mint: mintKeypair.publicKey, bondConfig, signature };
}
