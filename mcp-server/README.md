# Debt Bonds MCP Server

Model Context Protocol (stdio) server for the debt-bonds Anchor program on Solana. Exposes tools to set up bond markets, purchase bonds, transfer bond SPL tokens, query on-chain state, and read stablecoin balances.

## Prerequisites

- Node.js 20+
- `solana-test-validator` running (or devnet RPC)
- Program deployed: `cd ../chain && anchor build && anchor deploy`
- Funded keypair at `SOLANA_KEYPAIR_PATH`

After changing the on-chain program, sync the IDL:

```bash
npm run sync-idl
```

## Install and build

```bash
npm install
npm run build
```

## Environment

| Variable | Required | Default |
|----------|----------|---------|
| `SOLANA_RPC_URL` | No | `http://127.0.0.1:8899` |
| `SOLANA_KEYPAIR_PATH` | Write tools + default `owner` on reads | — |
| `DEBT_BONDS_PROGRAM_ID` | No | From `src/solana/idl.json` |

## Cursor configuration

Add to your Cursor MCP settings (use absolute paths):

```json
{
  "mcpServers": {
    "debt-bonds": {
      "command": "node",
      "args": ["/absolute/path/to/debt-bonds/mcp-server/dist/index.js"],
      "env": {
        "SOLANA_RPC_URL": "http://127.0.0.1:8899",
        "SOLANA_KEYPAIR_PATH": "/home/you/.config/solana/id.json"
      }
    }
  }
}
```

Development (no build step):

```json
{
  "mcpServers": {
    "debt-bonds": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/debt-bonds/mcp-server/src/index.ts"],
      "env": {
        "SOLANA_RPC_URL": "http://127.0.0.1:8899",
        "SOLANA_KEYPAIR_PATH": "/home/you/.config/solana/id.json"
      }
    }
  }
}
```

## Tools

### Write (requires `SOLANA_KEYPAIR_PATH`)

| Tool | Description |
|------|-------------|
| `setup_bond_market` | `create_bond` + `init_listing` + `add_supply_to_listing` in one transaction |
| `purchase_bond` | Buy bonds from the active listing |
| `transfer_bond_spl` | SPL transfer only; **Holder PDA / coupons do not move** (Phase 2 on-chain transfer planned) |

### Read

| Tool | Description |
|------|-------------|
| `get_bond` | BondConfig + Listing for a mint |
| `get_holder` | Holder PDA for mint + owner |
| `list_bond_holders` | All Holder PDAs for a mint |
| `get_bond_wallet_balance` | SPL ATA balance vs Holder `bonds_held` |
| `list_bonds_by_issuer` | BondConfig accounts by issuer |
| `get_stablecoin_balance` | SPL balance for any mint (e.g. payment stablecoin) |

## Localnet smoke test

1. Terminal 1: `solana-test-validator`
2. Terminal 2: `cd ../chain && anchor deploy`
3. Fund keypair: `solana airdrop 10 $(solana address -k $SOLANA_KEYPAIR_PATH) --url localhost`
4. Create a stablecoin via the dapp (`/tokens`) or CLI; note its mint for `payment_mint`
5. Use Cursor or `npx @modelcontextprotocol/inspector` to call:
   - `setup_bond_market` with `unit_price` in **atomic** payment-mint units
   - `get_bond` with returned `bond_mint`
   - `purchase_bond` from a **different** wallet (second keypair) if testing non-issuer buy
   - `get_bond_wallet_balance` and `get_holder` to compare SPL vs PDA state

## Phase 2 (not in this server yet)

On-chain `transfer_bond` that moves SPL tokens and updates `Holder` PDAs will replace raw `transfer_bond_spl` for secondary market transfers with correct coupon tracking.
