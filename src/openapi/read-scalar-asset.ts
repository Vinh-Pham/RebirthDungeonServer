import { readFile } from 'node:fs/promises';

// Node/build-time only. Workers import the copied text asset statically.
export function readScalarAsset(): Promise<string> {
  const packageEntry = import.meta.resolve('@scalar/api-reference');
  return readFile(new URL('./browser/standalone.js', packageEntry), 'utf8');
}
