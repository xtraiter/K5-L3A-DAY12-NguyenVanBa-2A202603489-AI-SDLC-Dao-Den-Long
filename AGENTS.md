# AGENTS.md — Đảo Đèn Lồng

3D web game (Three.js) + deterministic headless mode for Test Contract v1.0.
Spec source: the PRD/ticket of the current phase (lab board) + `docs/notes/phase-N.md` (assumptions).

## Commands
- Test (must be green before finishing): `npm test`
- Headless: `node src/headless.mjs --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario f] [--inputs f]`
- Play: `npm start` → http://localhost:8080
- Proof (headless + determinism + test report): `npm run proof`
- Visual proof (screenshots, console errors): `node scripts/browser-proof.mjs`

## Layout
- `src/sim/` pure gameplay: no DOM, no `Math.random`, no wall clock. All rules live here.
- `src/sim/config.js` TUNING = single source of numbers. `game.contract.json` tuning must equal it (tested).
- `src/headless.mjs` CLI + JSONL writer. `src/client/` rendering/input/audio only — never gameplay rules.
- `nhac/` optional music files (user-provided). `vendor/` pinned three.js r160.

## Rules
- Contract wording beats intuition: distances on XZ, "within r" means `<= r`, events of step k have tick k+1,
  snapshot tick 0 is before input, buttons fire on false→true, bad inputs/scenario → exit 2.
- Changing a gameplay number: edit `config.js` AND `game.contract.json` AND README scoring table.
- Extra/creative entities must not change headless output (gate them off in `Sim`, or keep them client-only).
- Every new rule gets a headless test in `tests/`. Never weaken or delete a test to make it pass; if a
  requirement changed, edit the test and note why in `docs/notes/phase-N.md`.
- Never use copyrighted game/film characters, music or names (docs/lab/RULES.md §8). Credit assets in CREDITS.md.
- Do not commit secrets, `node_modules/`, or temporary `*.jsonl` outside `docs/proof/`.
