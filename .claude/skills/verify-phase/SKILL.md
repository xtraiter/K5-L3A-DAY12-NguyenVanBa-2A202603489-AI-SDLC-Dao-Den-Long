---
name: verify-phase
description: Run all verification for the current phase and save evidence under docs/proof/phase-N (tests, headless scenario runs for all nights, determinism, full-night speed, screenshots + FPS). Use before tagging a phase or when asked for proof.
---

1. `npm test` — must be green. If red, fix code (not tests) unless the requirement changed (then note it in `docs/notes/phase-N.md`).
2. New feature? Add `tests/scenarios/n<night>-<feature>.scenario.json` (+ `.inputs.json`); the `nX-` prefix selects the night.
3. `npm run proof -- <N>` — writes `docs/proof/phase-<N>/`: test-report.txt, runs/*.jsonl, headless-summary.txt
   (determinism IDENTICAL ×3, full night < 30 s). Read the summary: check event ticks and scores make sense, not only exit codes.
4. `GPU=1 node scripts/browser-proof.mjs docs/proof/phase-<N>/screens` — screenshots of menu/intro/3 nights/pause,
   average FPS at 1280x720 (must be ≥ 30), console errors (must be 0).
5. Open the screenshots and check them against the ticket (palette, HUD layout, Mây with nón lá + lantern).
6. Update the requirement → evidence table in `docs/proof/phase-<N>/README.md`. Write "chưa đạt" honestly.
