import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { argon2id, setWASMModules } from 'argon2-wasm-edge';
import argon2WASM from 'argon2-wasm-edge/wasm/argon2.wasm';
import blake2bWASM from 'argon2-wasm-edge/wasm/blake2b.wasm';
import {
  PASSWORD_OPTIONS,
  type PasswordHasher,
} from '../auth/password-hasher.js';

// Statically bundled modules: Workers prohibit compiling Wasm from bytes at runtime.
await setWASMModules({ argon2WASM, blake2bWASM });
const hashParameters = z.strictObject({
  m: z.int().positive(),
  t: z.int().positive(),
  p: z.int().positive(),
});
export const workerPasswordHasher: PasswordHasher = {
  hash(password) {
    return argon2id({
      password,
      salt: crypto.getRandomValues(new Uint8Array(16)),
      memorySize: PASSWORD_OPTIONS.memoryCost,
      iterations: PASSWORD_OPTIONS.timeCost,
      parallelism: PASSWORD_OPTIONS.parallelism,
      hashLength: 32,
      outputType: 'encoded',
    });
  },
  async verify(encoded, password) {
    // Read the standard PHC encoding stored by both native Argon2 and this Worker.
    // The package's verify helper compares strings; compare derived bytes in constant time instead.
    const match =
      /^\$argon2id\$v=19\$([mtp]=\d+(?:,[mtp]=\d+){2})\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(
        encoded,
      );
    if (!match) throw new Error('Unsupported password hash');
    const [, parameters, salt, digest] = match;
    const parsed = hashParameters.safeParse(
      Object.fromEntries(
        parameters.split(',').map((parameter) => {
          const [key, value] = parameter.split('=');
          return [key, Number(value)];
        }),
      ),
    );
    if (!parsed.success) throw new Error('Unsupported password hash');
    const expected = Buffer.from(digest, 'base64');
    const actual = await argon2id({
      password,
      salt: Buffer.from(salt, 'base64'),
      memorySize: parsed.data.m,
      iterations: parsed.data.t,
      parallelism: parsed.data.p,
      hashLength: expected.length,
      outputType: 'binary',
    });
    return timingSafeEqual(actual, expected);
  },
};
