// dist/esm is ES modules even though the package root is CommonJS.
import { writeFileSync } from 'node:fs';
writeFileSync(new URL('../dist/esm/package.json', import.meta.url), '{ "type": "module" }\n');
