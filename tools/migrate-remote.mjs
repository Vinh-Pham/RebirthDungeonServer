import { spawnSync } from 'node:child_process';
import { checkRemote } from './check-remote.mjs';

const pending = await checkRemote();
if (pending.length) {
  const result = spawnSync('pnpm', ['exec', 'drizzle-kit', 'migrate'], {
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} else {
  console.log('Remote D1 is already current. No writes performed.');
}
