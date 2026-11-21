import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listCharacterIds } from './characters.js';
import { characterUrl, qrBuffer } from './qr-image.js';

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../qr-out');

await mkdir(OUT_DIR, { recursive: true });

for (const id of await listCharacterIds()) {
  const file = path.join(OUT_DIR, `qr-${id}.png`);
  await writeFile(file, await qrBuffer(id));
  console.log(`${id} → ${characterUrl(id)}\n    ${file}`);
}
