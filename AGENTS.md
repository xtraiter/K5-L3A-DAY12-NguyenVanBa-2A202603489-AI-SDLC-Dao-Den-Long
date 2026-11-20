# AGENTS.md — Đảo Đèn Lồng

3D web game (Three.js) + deterministic headless mode for **Test Contract v1.1** (3 nights).
Spec source: the ticket of the current phase (lab board) + `docs/notes/phase-N.md` (acceptance criteria, assumptions).

## Commands
- Test (must be green before finishing): `npm test`
- Headless: `node src/headless.mjs --seed 1 --night 1|2|3 --ticks 600 --out out.jsonl [--scenario f] [--inputs f]`
- Play: `npm start` → http://localhost:8080 (`?night=2&play` jumps straight into a night)
- Proof (tests + scenario runs + determinism + speed): `npm run proof`
- Visual proof (screenshots, FPS 1280x720, console errors): `GPU=1 node scripts/browser-proof.mjs`
- Static build for Cloudflare Pages: `npm run build:web` → `dist/`

## Layout
- `src/sim/` pure gameplay: no DOM, no `Math.random`, no wall clock. All rules live here.
  - `config.js`: `TUNING` (contract keys, must equal `game.contract.json`, tested) + `RULES` (other standard numbers).
  - `maps.js`: the three standard maps; `ground(x, z)` returns height or `null` (cloud sea).
  - `sim.js`: `step()` follows Ticket-02's 12-step tick order; keep that order.
- `src/headless.mjs` CLI + JSONL writer. `src/client/` rendering/input/audio/HUD only — never gameplay rules.
- `nhac/` music (user-made / AI). `vendor/` pinned three.js r160.

## Rules
- Contract wording beats intuition: XZ distances, "within r" means `<= r`, events of step k have tick k+1,
  snapshot tick 0 is before input, buttons fire on false→true, bad inputs/scenario → exit 2,
  shade states exactly `spawning|wander|chase|recoil|stunned`.
- Changing a gameplay number: edit `config.js` AND `game.contract.json` AND README scoring table.
- Extra/creative entities must not change headless output (client-only, or gated off in `Sim`).
- Every new rule gets a headless test in `tests/` (`features.test.mjs` for features). Never weaken or delete a
  test to make it pass; if a requirement changed, edit the test and note why in `docs/notes/phase-N.md`.
- Edit code with the Edit/Write tools, not `node -e`/heredocs in bash: the shell eats `${}` and backticks.
- Client FPS must be measured with `GPU=1` (SwiftShader numbers are CPU rendering, not representative).
- Never use copyrighted game/film characters, music or names (docs/lab/RULES.md §8). Credit assets in CREDITS.md.
- Do not commit secrets, `node_modules/`, `dist/`, or temporary `*.jsonl` outside `docs/proof/`.
