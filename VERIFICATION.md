# Verification

Completed before packaging:

- `npm run build` — passed with TypeScript and Vite.
- `solc 0.8.24` ABI and bytecode generation — passed.
- Runtime bytecode package remains below the EVM contract-size limit (creation bytecode output: 17,113 bytes).
- `copy-lint.mjs --kind software` — 0 failures, 0 warnings.
- `moments.mjs check --page software` — two compatible moments, 0 faults.
- Local browser preview — hero, crop-cover form, policy ledger, claim flow, reserve panel, weather form and footer rendered.
- Wallet navigation — Connect wallet remains available inside the tablet/phone navigation sheet.
- Wallet chooser — opens only after a click and provides a mobile-wallet route when no extension is available.
- Frontend writes are blocked in preview mode and until account, BOT Chain and deployed bytecode checks pass.

Final gate: `GATE: ERROR` — no failures were found in the checks that ran, but `consistency.mjs` produced no report because Chrome exited early and `check.mjs` could not start Chrome. Per the skill gate instruction, it was not rerun. The page was instead inspected in the in-app browser and built at production settings.

No professional smart-contract audit was performed.

