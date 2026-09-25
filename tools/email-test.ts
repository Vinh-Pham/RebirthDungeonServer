import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { getPlatformProxy, unstable_readConfig } from 'wrangler';
import {
  prepareTestEmail,
  sendTestEmail,
  testEmailInputSchema,
  type EmailConfig,
} from '../src/email/service.js';

const require = createRequire(import.meta.url);
export function parseEmailArgs(args: string[]) {
  const { values, tokens } = parseArgs({
    tokens: true,
    args,
    strict: true,
    allowPositionals: false,
    options: {
      to: { type: 'string' },
      name: { type: 'string' },
      send: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  const optionNames = tokens
    .filter((token) => token.kind === 'option')
    .map((token) => token.name);
  if (new Set(optionNames).size !== optionNames.length)
    throw new Error('Specify each option only once.');
  if (values.help) return { help: true as const };
  const input = testEmailInputSchema.safeParse({
    to: values.to,
    recipientName: values.name,
  });
  if (!input.success)
    throw new Error(
      'Provide one valid --to address and an optional --name of 1–100 characters.',
    );
  return { help: false as const, live: values.send, input: input.data };
}

export function liveSendArgs(
  message: Awaited<ReturnType<typeof prepareTestEmail>>,
) {
  return [
    'email',
    'sending',
    'send',
    '--from',
    message.from.email,
    '--from-name',
    message.from.name,
    '--to',
    message.to,
    '--subject',
    message.subject,
    '--html',
    message.html,
    '--text',
    message.text,
  ];
}

export async function runWrangler(args: string[]): Promise<number> {
  let executable: string;
  try {
    const packagePath = require.resolve('wrangler/package.json');
    const metadata = require(packagePath) as { bin: { wrangler: string } };
    executable = resolve(dirname(packagePath), metadata.bin.wrangler);
  } catch {
    console.error(
      'Could not locate the installed Wrangler executable. Run pnpm install and retry.',
    );
    return 1;
  }
  return new Promise((done) => {
    const child = spawn(process.execPath, [executable, ...args], {
      shell: false,
      stdio: 'inherit',
    });
    child.on('error', () => {
      console.error(
        'Could not start Wrangler. Check the local Node.js installation.',
      );
      done(1);
    });
    child.on('exit', (code) => done(code ?? 1));
  });
}

const defaultDependencies = {
  config: () =>
    unstable_readConfig({ config: 'wrangler.jsonc' }).vars as EmailConfig,
  simulate: async (input: Parameters<typeof sendTestEmail>[1]) => {
    const proxy = await getPlatformProxy<CloudflareBindings>({
      configPath: 'wrangler.jsonc',
      remoteBindings: false,
      persist: false,
    });
    try {
      return await sendTestEmail(proxy.env, input);
    } finally {
      await proxy.dispose();
    }
  },
  live: runWrangler,
  log: (message: string) => console.log(message),
};

export async function runEmailTest(
  args: string[],
  dependencies = defaultDependencies,
): Promise<number> {
  const parsed = parseEmailArgs(args);
  if (parsed.help) {
    dependencies.log(
      'Usage: pnpm email:test --to <address> [--name <name>] [--send]\nDefault: local simulation only. --send delivers one real email using Wrangler authentication.',
    );
    return 0;
  }
  if (!parsed.live) {
    dependencies.log(
      'Local simulation: no email will be delivered. Wrangler may print and save the example content locally.',
    );
    const result = await dependencies.simulate(parsed.input);
    dependencies.log(
      `Simulated email accepted: ${result.messageId}. No email was delivered.`,
    );
    return 0;
  }
  const message = await prepareTestEmail(dependencies.config(), parsed.input);
  dependencies.log(
    'Sending one real test email through Cloudflare Email Sending. Acceptance does not confirm inbox delivery.',
  );
  return dependencies.live(liveSendArgs(message));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    process.exitCode = await runEmailTest(process.argv.slice(2));
  } catch {
    console.error(
      'Email test failed. Check command arguments, sender configuration, and Cloudflare Email Sending access. Use --help for usage.',
    );
    process.exitCode = 1;
  }
}
