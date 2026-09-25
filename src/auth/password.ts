import { timingSafeEqual } from 'node:crypto';
import { argon2id, setWASMModules } from 'argon2-wasm-edge';
import argon2WASM from 'argon2-wasm-edge/wasm/argon2.wasm';
import blake2bWASM from 'argon2-wasm-edge/wasm/blake2b.wasm';

await setWASMModules({ argon2WASM, blake2bWASM });

// A public dummy hash avoids a fast path for nonexistent accounts. It is never stored as a user's password.
export const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$AQEBAQEBAQEBAQEBAQEBAQ$0oUCGb1yaKi+LuMHisFDJYucmB7o3BtWO1pcbKReweI';

export function hashPassword(password: string): Promise<string> {
  return argon2id({
    password,
    salt: crypto.getRandomValues(new Uint8Array(16)),
    memorySize: 19456,
    iterations: 2,
    parallelism: 1,
    hashLength: 32,
    outputType: 'encoded',
  });
}

export async function verifyPassword(
  encoded: string,
  password: string,
): Promise<boolean> {
  const match =
    /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(
      encoded,
    );
  if (!match) throw new Error('Unsupported password hash');
  const [, memory, iterations, parallelism, salt, digest] = match;
  // This deployment's legacy hashes use these exact parameters. Bound stored work factors.
  if (
    Number(memory) !== 19456 ||
    Number(iterations) !== 2 ||
    Number(parallelism) !== 1
  ) {
    throw new Error('Unsupported password parameters');
  }
  const expected = Buffer.from(digest!, 'base64');
  const decodedSalt = Buffer.from(salt!, 'base64');
  if (expected.length !== 32 || decodedSalt.length !== 16)
    throw new Error('Unsupported password hash');
  const actual = await argon2id({
    password,
    salt: decodedSalt,
    memorySize: 19456,
    iterations: 2,
    parallelism: 1,
    hashLength: 32,
    outputType: 'binary',
  });
  return timingSafeEqual(actual, expected);
}
