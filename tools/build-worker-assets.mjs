import { mkdir, writeFile } from 'node:fs/promises';
import { readScalarAsset } from '../dist/openapi/read-scalar-asset.js';

// Copy the locked Scalar standalone browser bundle without starting an HTTP server.
await mkdir('dist/worker', { recursive: true });
await writeFile('dist/worker/scalar.js.txt', await readScalarAsset());
