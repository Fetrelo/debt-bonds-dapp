# Debt Bonds (Anchor + Next.js)

Fresh project scaffold for a Solana debt-bond dApp.

- On-chain program in `chain/` (Anchor + Rust).
- Web dApp in `dapp/` (Next.js 16 App Router + Solana wallet adapter).

This MVP only covers connecting a wallet against localnet. There is no on-chain
business logic yet beyond the default Anchor `initialize` instruction.

## Project Structure

```text
debt-bonds/
├── chain/   # Anchor program + tests
└── dapp/    # Next.js frontend
```

## Requirements

- Rust + Cargo
- Solana CLI (3.x / Agave)
- Anchor CLI 0.31.x
- Node.js 20+

## 1) Chain (Anchor)

JS deps were installed by `anchor init`. To re-install:

```bash
npm --prefix chain install
```

Build the program:

```bash
cd chain
anchor build
```

Run tests against a local validator:

```bash
cd chain
anchor test --skip-local-validator
```

The program id is fixed in [`chain/Anchor.toml`](chain/Anchor.toml) and
[`chain/programs/debt-bonds/src/lib.rs`](chain/programs/debt-bonds/src/lib.rs)
to the keypair under `chain/target/deploy/debt_bonds-keypair.json`.

## 2) dApp (Next.js)

Install deps (already done if you ran `npm install` in `dapp/`):

```bash
npm --prefix dapp install --legacy-peer-deps
```

The `--legacy-peer-deps` flag is needed because the Solana wallet-adapter
packages still declare React 18 peer ranges while the dApp ships React 19.

Create the local env file:

```bash
cp dapp/.env.local.example dapp/.env.local
```

Start the dev server:

```bash
npm --prefix dapp run dev
```

Then open `http://localhost:3000` and click "Select Wallet" to connect a
Phantom or Solflare wallet pointed at your local validator.

Lint and build:

```bash
npm --prefix dapp run lint
npm --prefix dapp run build
```

## 3) Localnet flow (3 terminals)

Terminal 1:

```bash
solana-test-validator
```

Terminal 2:

```bash
cd chain
anchor build
anchor test --skip-local-validator
```

Terminal 3:

```bash
npm --prefix dapp run dev
```

## Configuration

The dApp reads the RPC endpoint from `NEXT_PUBLIC_SOLANA_RPC_URL`
(see [`dapp/src/lib/cluster.ts`](dapp/src/lib/cluster.ts)). Defaults to
`http://127.0.0.1:8899`. Switch to devnet by setting:

```text
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
```

To deploy the program to devnet, also update `[provider].cluster` in
[`chain/Anchor.toml`](chain/Anchor.toml) and run `anchor deploy`.
