import { spawnSync } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Commands carry explicit scope; credentials remain in the CLI secure store.
const [record, ...command] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(record || '') || !command.length) throw new Error('Usage: taptap.mjs record-name <CLI command...>');
const root = new URL('../', import.meta.url);
const executable = 'C:/Users/qs/AppData/Roaming/npm/node_modules/@taptap/cli/bin/taptap-cli-windows-amd64.exe';
const run = spawnSync(executable, command, { cwd: fileURLToPath(root), encoding: 'utf8', windowsHide: true });
let response;
try { response = JSON.parse(run.stdout || run.stderr); } catch { throw new Error(`CLI did not return JSON (exit ${run.status}): ${run.error?.message || 'see CLI output'}`); }
function safe(value) {
  if (Array.isArray(value)) return value.map(safe);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /token|credential|secret|device.code/i.test(key) ? '[REDACTED]' : safe(item)]));
}
const result = safe(response);
await mkdir(new URL('platform/', root), { recursive: true });
await writeFile(new URL(`platform/${record}.json`, root), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
process.exitCode = run.status || (response.ok ? 0 : 1);
