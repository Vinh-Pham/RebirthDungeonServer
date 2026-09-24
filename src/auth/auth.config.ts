export const AUTH_CONFIG = Symbol('AUTH_CONFIG');
export interface AuthConfig {
  secret: string;
  issuer: string;
  audience: string;
}
export function authConfig(secret: string = ''): AuthConfig {
  if (Buffer.byteLength(secret) < 32)
    throw new Error('JWT_ACCESS_SECRET must contain at least 32 bytes');
  return {
    secret,
    issuer: 'rebirth-dungeon-server',
    audience: 'rebirth-dungeon-game',
  };
}
