import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DebtBonds } from "../target/types/debt_bonds";

describe("debt-bonds", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.debtBonds as Program<DebtBonds>;

  it("Is initialized!", async () => {
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
