import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Carpeta publicada en GitHub Pages (frontend + datos de personajes). */
export const DOCS_DIR = path.resolve(here, '../../docs');
export const CHARACTERS_DIR = path.join(DOCS_DIR, 'characters');

export interface Character {
  id: string;
  name: string;
  fps: number;
  palette: Record<string, string>;
  /** Vista de frente (mira hacia la cámara). */
  frames: string[][];
  /** Vista de espaldas (opcional; si falta se reutiliza "frames"). */
  back?: string[][];
}

export const ID_PATTERN = /^[a-z0-9-]+$/i;
const MAX_SIZE = 64; // px por lado de un fotograma
const MAX_FRAMES = 12;

export async function readCharacter(id: string): Promise<Character> {
  if (!ID_PATTERN.test(id)) throw new Error(`Id no válido: ${id}`);
  const raw = await readFile(path.join(CHARACTERS_DIR, `${id}.json`), 'utf8');
  return JSON.parse(raw) as Character;
}

export async function listCharacterIds(): Promise<string[]> {
  const files = await readdir(CHARACTERS_DIR);
  return files
    .filter((f) => f.endsWith('.json') && f !== 'index.json')
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
}

/** Devuelve la lista de problemas encontrados (vacía si el personaje es válido). */
export function validateCharacter(c: Character, expectedId: string): string[] {
  const errors: string[] = [];
  if (c.id !== expectedId) errors.push(`id "${c.id}" no coincide con el archivo "${expectedId}.json"`);
  if (!ID_PATTERN.test(c.id)) errors.push('id solo admite letras, números y guiones');
  if (c.id.toLowerCase() === 'index') errors.push('el id "index" está reservado');
  if (!c.name?.trim()) errors.push('falta "name"');
  if (!(c.fps > 0 && c.fps <= 30)) errors.push('"fps" debe estar entre 1 y 30');

  const palette = c.palette ?? {};
  for (const [key, color] of Object.entries(palette)) {
    if (key.length !== 1 || key === '.') errors.push(`clave de paleta no válida: "${key}"`);
    if (!/^#[0-9a-f]{6}$/i.test(color)) errors.push(`color no válido para "${key}": ${color}`);
  }

  if (!Array.isArray(c.frames) || c.frames.length === 0) {
    errors.push('"frames" debe tener al menos un fotograma');
    return errors;
  }
  const width = c.frames[0]?.[0]?.length ?? 0;
  const height = c.frames[0]?.length ?? 0;
  if (width < 1 || height < 1 || width > MAX_SIZE || height > MAX_SIZE) {
    errors.push(`el tamaño del sprite debe estar entre 1 y ${MAX_SIZE} px (es ${width}×${height})`);
  }
  if (c.frames.length > MAX_FRAMES) errors.push(`"frames" admite como máximo ${MAX_FRAMES} fotogramas`);
  if ((c.back?.length ?? 0) > MAX_FRAMES) errors.push(`"back" admite como máximo ${MAX_FRAMES} fotogramas`);
  const views: [string, string[][]][] = [['frames', c.frames]];
  if (c.back !== undefined) {
    if (!Array.isArray(c.back) || c.back.length === 0) errors.push('"back" debe tener al menos un fotograma');
    else views.push(['back', c.back]);
  }
  for (const [view, frames] of views) {
    frames.forEach((rows, i) => {
      const where = `${view}[${i}]`;
      if (rows.length !== height) errors.push(`${where}: tiene ${rows.length} filas, se esperaban ${height}`);
      rows.forEach((row, y) => {
        if (row.length !== width) errors.push(`${where}, fila ${y}: ${row.length} columnas, se esperaban ${width}`);
        for (const ch of row) {
          if (ch !== '.' && !(ch in palette)) errors.push(`${where}, fila ${y}: "${ch}" no está en la paleta`);
        }
      });
    });
  }
  return errors;
}
