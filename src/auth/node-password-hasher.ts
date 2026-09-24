import * as argon2 from 'argon2';
import { PASSWORD_OPTIONS, type PasswordHasher } from './password-hasher.js';
export const nodePasswordHasher: PasswordHasher = {
  hash: (password) =>
    argon2.hash(password, { ...PASSWORD_OPTIONS, type: argon2.argon2id }),
  verify: (encoded, password) => argon2.verify(encoded, password),
};
