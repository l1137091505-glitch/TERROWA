# TERROWA build plan

Kind: software / fintech

Deal: triptych hero; palette `putty-black-teal`; type `onest`; nav-cards; footer-columns; close-word; space rhythm; arrow buttons; wordmark; sharp fintech radius; moments `pinned-chapters` and `liquid-type`. The first moment deal, `line-carries-colour`, required a new full-width ground and conflicted with the dealt `space` rhythm, so it was re-dealt. A second scroll moment conflicted with `pinned-chapters`, so the distinct pointer-led `liquid-type` moment replaced it. The warm stone ground separates TERROWA from the reference site's sky blue and the previous builds' navy, pink, lime and orange interfaces. The dealt palette contains no violet.

Voice: technical-direct. Exact, not promotional; cautious around financial risk; short field labels and errors; the product is the subject in feature lines. House words: cover, policy, claim, reserve, assessor. Never: guaranteed protection, guaranteed yield, insured funds, audited, risk-free.

Reader order:

1. Hero — an experimental crop-coverage workspace for BOT Chain; product UI as the picture; one screen.
2. App frame — buy cover with live premium, payout cap and reserve checks; the full product window; one screen.
3. Policy ledger — active and expired policies with claim status; rewritten UI fragment; one screen.
4. Claims desk — evidence CID, requested amount and assessor outcome; split text left, UI right; one screen.
5. Reserve pool — stake, withdraw and claim accrued premium share; diagram plus exact lock/risk text; one screen.
6. Weather register — owner-reported observations and contract counters; ruled event ledger; one screen.
7. Questions — five open answers covering wallet access, claims, IPFS, assessor authority and liquidity; one screen.
8. Closing/footer — main action and deployment links; one screen.

Facts supplied by the reference product:

- BOT Chain uses chain ID 677.
- Crop-cover categories: drought, flood, frost, pests and comprehensive.
- A policy records crop, region, declared value and duration.
- A claim records a requested amount, a loss description and an IPFS evidence CID.
- An assessor reviews claims on-chain.
- The pool accepts BOT stakes and applies a seven-day withdrawal lock.
- The owner can report weather observations.

Original implementation decisions:

- The Solidity contract is new and has a no-argument constructor.
- The contract is an experimental coverage pool, not a licensed insurer.
- Cover is only issued when unreserved pool liquidity can support the payout cap.
- Premiums accrue to stakers through an accumulator; withdrawals remain subject to solvency.
- Writes are disabled until the connected chain, account and deployed bytecode pass preflight checks.
- Wallet access uses EIP-6963 discovery, legacy injected-provider fallback, mobile deep links, chain add/switch and account/chain listeners.
- Preview mode reads sample data but never reports a fake transaction.

Assets: live HTML product UI, contract-state diagrams and text-led ledgers. No stock photography, no invented customers, no testimonial, no fake performance figure.

Motion: hero entrance brings the category first and then the three product records; `pinned-chapters` in the claims desk keeps the filing, review and payment states in one place; `liquid-type` lets the reserve rule respond to the pointer and stands still on touch; every link and button answers hover, keyboard and press.

Tablet plan: all product splits stack to one screen where content fits; app-frame and reserve pool may use two screens at 768px if the dealt recipe requires it.

