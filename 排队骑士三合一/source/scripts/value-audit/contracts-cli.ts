import { runBattleContracts } from './battle-contracts';
import { runEconomyContracts } from './economy-contracts';
const checks = [...runBattleContracts().checks, ...runEconomyContracts().checks];
const failures = checks.filter((c) => c.status === 'fail');
console.log(JSON.stringify({ checks: checks.length, passed: checks.length - failures.length, failed: failures.length, failures }, null, 2));
if (failures.length) (globalThis as unknown as { process: { exitCode: number } }).process.exitCode = 1;
