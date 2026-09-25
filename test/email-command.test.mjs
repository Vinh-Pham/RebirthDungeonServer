import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { parseEmailArgs, runEmailTest } from '../tools/email-test.ts';

function dependencies() {
  const calls = { simulation: [], live: [], logs: [] };
  return {
    calls,
    config: () => ({
      EMAIL_FROM: 'noreply@rebirthdungeon.com',
      EMAIL_FROM_NAME: 'Rebirth Dungeon',
    }),
    simulate: async (input) => {
      calls.simulation.push(input);
      return { messageId: 'simulated-id' };
    },
    live: async (args) => {
      calls.live.push(args);
      return 0;
    },
    log: (message) => calls.logs.push(message),
  };
}

test('requires one valid recipient and rejects unknown or malformed arguments', () => {
  for (const args of [
    [],
    ['--to', 'invalid'],
    ['--to', 'one@example.com,two@example.com'],
    ['--unknown'],
    ['--to', 'one@example.com', '--to', 'two@example.com'],
    ['--to', 'one@example.com', '--name', ''],
    ['--to', 'one@example.com', 'extra'],
  ])
    assert.throws(() => parseEmailArgs(args));
  assert.deepEqual(parseEmailArgs(['--help']), { help: true });
});

test('defaults to simulation without a live command', async () => {
  const deps = dependencies();
  assert.equal(await runEmailTest(['--to', 'preview@example.com'], deps), 0);
  assert.deepEqual(deps.calls.simulation, [
    { to: 'preview@example.com', recipientName: 'Adventurer' },
  ]);
  assert.equal(deps.calls.live.length, 0);
  assert.match(deps.calls.logs.join(' '), /No email was delivered/);
});

test('explicit live mode passes rendered content as separate arguments', async () => {
  const deps = dependencies();
  const name = 'Adventurer $(echo nope) `echo nope`';
  assert.equal(
    await runEmailTest(
      ['--send', '--to', 'preview@example.com', '--name', name],
      deps,
    ),
    0,
  );
  assert.equal(deps.calls.simulation.length, 0);
  const args = deps.calls.live[0];
  assert.deepEqual(args.slice(0, 3), ['email', 'sending', 'send']);
  assert.equal(args[args.indexOf('--to') + 1], 'preview@example.com');
  assert.equal(
    args[args.indexOf('--subject') + 1],
    'Rebirth Dungeon — Test email',
  );
  assert.ok(args[args.indexOf('--html') + 1].includes(name));
  assert.ok(args[args.indexOf('--text') + 1].includes(name));
});

test('preserves live-command failure and propagates simulation failure', async () => {
  const deps = dependencies();
  deps.live = async () => 7;
  assert.equal(
    await runEmailTest(['--send', '--to', 'preview@example.com'], deps),
    7,
  );
  deps.simulate = async () => {
    throw new Error('simulation failed');
  };
  await assert.rejects(
    () => runEmailTest(['--to', 'preview@example.com'], deps),
    /simulation failed/,
  );
});

test('invalid CLI invocation exits nonzero without exposing supplied input', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      'tools/email-test.ts',
      '--to',
      'private-invalid-address',
    ],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Email test failed/);
  assert.ok(!result.stderr.includes('private-invalid-address'));
});

test('the real local simulation command succeeds after closing its runtime', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'tools/email-test.ts', '--to', 'preview@example.com'],
    { encoding: 'utf8', timeout: 20000 },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /Simulated email accepted: .+\. No email was delivered\./,
  );
});

test('the live launcher starts the installed Wrangler email command without sending', async () => {
  const { runWrangler } = await import('../tools/email-test.ts');
  assert.equal(await runWrangler(['email', 'sending', 'send', '--help']), 0);
});
