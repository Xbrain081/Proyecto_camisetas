import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { listCharacterIds } from './characters.js';

const BASE_URL = (process.env.BASE_URL ?? 'https://xbrain081.github.io/Proyecto_camisetas/').replace(/\/?$/, '/');
const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../qr-out');

await mkdir(OUT_DIR, { recursive: true });

for (const id of await listCharacterIds()) {
  const url = `${BASE_URL}?c=${encodeURIComponent(id)}`;
  const file = path.join(OUT_DIR, `qr-${id}.png`);
  // Corrección de errores alta (H): el QR sigue leyéndose aunque la tela se desgaste un poco.
  await QRCode.toFile(file, url, { errorCorrectionLevel: 'H', margin: 4, scale: 16 });
  console.log(`${id} → ${url}\n    ${file}`);
}
