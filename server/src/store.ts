import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CHARACTERS_DIR, type Character, validateCharacter } from './characters.js';

const isRows = (v: unknown): v is string[][] =>
  Array.isArray(v) && v.every((frame) => Array.isArray(frame) && frame.every((row) => typeof row === 'string'));

/** Comprueba la forma del JSON recibido (los detalles de contenido los revisa validateCharacter). */
function asCharacter(input: unknown): Character {
  const c = input as Partial<Character> | null;
  const ok =
    typeof c === 'object' &&
    c !== null &&
    typeof c.id === 'string' &&
    typeof c.name === 'string' &&
    typeof c.fps === 'number' &&
    typeof c.palette === 'object' &&
    c.palette !== null &&
    Object.values(c.palette).every((v) => typeof v === 'string') &&
    isRows(c.frames) &&
    (c.back === undefined || isRows(c.back));
  if (!ok) throw new ValidationError(['El personaje no tiene el formato esperado.']);
  return c as Character;
}

export class ValidationError extends Error {
  constructor(public details: string[]) {
    super(details.join('\n'));
  }
}

/** Formato legible: cada fila de píxeles en una línea, para que el arte se vea en el JSON. */
export function formatCharacter(c: Character): string {
  const view = (frames: string[][]) =>
    '[\n' +
    frames
      .map((rows) => '    [\n' + rows.map((row) => `      ${JSON.stringify(row)}`).join(',\n') + '\n    ]')
      .join(',\n') +
    '\n  ]';
  const palette = Object.entries(c.palette)
    .map(([key, color]) => `    ${JSON.stringify(key)}: ${JSON.stringify(color)}`)
    .join(',\n');
  const parts = [
    `  "id": ${JSON.stringify(c.id)}`,
    `  "name": ${JSON.stringify(c.name)}`,
    `  "fps": ${c.fps}`,
    `  "palette": {\n${palette}\n  }`,
    `  "frames": ${view(c.frames)}`,
  ];
  if (c.back) parts.push(`  "back": ${view(c.back)}`);
  return `{\n${parts.join(',\n')}\n}\n`;
}

/** Valida y guarda el personaje, y lo añade (o actualiza) en el índice público. */
export async function saveCharacter(input: unknown): Promise<Character> {
  const c = asCharacter(input);
  c.name = c.name.trim();
  const errors = validateCharacter(c, c.id);
  if (errors.length) throw new ValidationError(errors);

  await writeFile(path.join(CHARACTERS_DIR, `${c.id}.json`), formatCharacter(c), 'utf8');

  const indexPath = path.join(CHARACTERS_DIR, 'index.json');
  const index = JSON.parse(await readFile(indexPath, 'utf8')) as { characters: { id: string; name: string }[] };
  const characters = index.characters.filter((x) => x.id !== c.id);
  characters.push({ id: c.id, name: c.name });
  characters.sort((a, b) => (a.id < b.id ? -1 : 1));
  await writeFile(indexPath, JSON.stringify({ characters }, null, 2) + '\n', 'utf8');
  return c;
}
