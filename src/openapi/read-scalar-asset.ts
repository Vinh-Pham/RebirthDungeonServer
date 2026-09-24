import { readFile } from 'node:fs/promises';

// Build-time only. Workers Static Assets serves the copied browser file.
export function readScalarAsset(): Promise<string> {
  const packageEntry = import.meta.resolve('@scalar/api-reference');
  return readFile(new URL('./browser/standalone.js', packageEntry), 'utf8');
}
