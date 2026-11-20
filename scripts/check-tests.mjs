// Claude Code Stop hook: refuse to finish while `npm test` is red.
// Exit 2 + stderr message => the agent is told to keep working.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let payload = {};
try {
  payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {}

const r = spawnSync('npm', ['test', '--silent'], { encoding: 'utf8', shell: true });
if (r.status === 0) process.exit(0);

const tail = `${r.stdout}\n${r.stderr}`.split('\n').filter((l) => /✖|not ok|Error|fail/i.test(l)).slice(0, 15).join('\n');
process.stderr.write(`npm test is failing — fix it before finishing (do not weaken tests).\n${tail}\n`);
// Avoid an endless loop if the agent already tried once and still cannot fix it.
process.exit(payload.stop_hook_active ? 0 : 2);
