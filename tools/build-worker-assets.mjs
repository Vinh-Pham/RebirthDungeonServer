import { mkdir, writeFile } from 'node:fs/promises';
import { readScalarAsset } from '../dist/openapi/read-scalar-asset.js';

// Only browser assets belong here; never publish the compiled server directory.
await mkdir('dist/assets/docs/js', { recursive: true });
await writeFile('dist/assets/docs/js/scalar.js', await readScalarAsset());
