---
name: verify-phase
description: Run all verification for the current phase and save evidence under docs/proof/phase-N (tests, headless runs, determinism, screenshots). Use before tagging a phase or when asked for proof.
---

1. `npm test` — must be green. If red, fix code (not tests) unless the requirement changed.
2. `npm run proof -- <N>` — writes `docs/proof/phase-<N>/`: test-report.txt, sample headless runs, determinism check.
3. `node scripts/browser-proof.mjs docs/proof/phase-<N>/screens` — screenshots + console errors (must be 0).
4. Open the screenshots and check them against the PRD look (warm orange = good, purple-black = danger, Mây with nón lá + small lantern).
5. Update the requirement → evidence table in `docs/proof/phase-<N>/README.md`. Write "chưa đạt" honestly for anything missing.
