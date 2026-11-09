# TERROWA

TERROWA is an original BOT Chain crop-coverage workspace. It combines policy pricing, evidence-backed claims, an assessor queue, pooled BOT liquidity and owner-reported weather observations.

This repository is an independent implementation inspired by the product category of the supplied reference. Its name, interface, copy, layout, wallet layer and Solidity contract are new.

## Important notice

TERROWA is experimental software. It is not presented as a licensed insurance product, the contract has not received a professional security audit, and no return or payout is guaranteed. Use small test amounts first.

## Repository

- `contracts/src/Terrowa.sol` — self-contained Solidity 0.8.24 contract with a no-argument constructor.
- `contracts/build` — ABI and bytecode produced with solc 0.8.24.
- `frontend` — Vite + TypeScript client.
- `DEPLOY-ZH.md` — GitHub, Remix and Vercel deployment guide.
- `VERIFICATION.md` — checks completed before packaging.

## Local development

```bash
cd frontend
npm install
npm run dev
```

Create `frontend/.env.local` after deployment:

```text
VITE_TERROWA_ADDRESS=0xYourDeployedContractAddress
```

## Contract flow

1. Deploy `Terrowa` with no constructor arguments.
2. Add liquidity with `stake` or `fundReserve` before selling cover.
3. A farmer calls `buyPolicy` with the exact quoted premium.
4. The farmer files a claim with an IPFS CID.
5. The appointed assessor calls `reviewClaim`.
6. Approved claims pay only when the remaining reserve still supports every active policy.

## Wallet compatibility

The client discovers EIP-6963 wallets, falls back to legacy injected providers, handles provider arrays, adds or switches BOT Chain, listens for account and network changes, validates deployed bytecode, and exposes a mobile-wallet deep link. It never calls `eth_requestAccounts` until the visitor chooses a wallet.

