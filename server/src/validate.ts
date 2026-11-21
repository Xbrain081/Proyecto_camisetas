import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CHARACTERS_DIR, listCharacterIds, readCharacter, validateCharacter } from './characters.js';

let failed = false;
const ids = await listCharacterIds();

for (const id of ids) {
  try {
    const errors = validateCharacter(await readCharacter(id), id);
    if (errors.length) {
      failed = true;
      console.error(`✗ ${id}`);
      errors.forEach((e) => console.error(`    - ${e}`));
    } else {
      console.log(`✓ ${id}`);
    }
  } catch (err) {
    failed = true;
    console.error(`✗ ${id}: ${(err as Error).message}`);
  }
}

// El índice público debe listar exactamente los personajes que existen.
const index = JSON.parse(await readFile(path.join(CHARACTERS_DIR, 'index.json'), 'utf8')) as {
  characters: { id: string }[];
};
const indexed = index.characters.map((c) => c.id).sort();
if (JSON.stringify(indexed) !== JSON.stringify(ids)) {
  failed = true;
  console.error(`✗ index.json (${indexed.join(', ')}) no coincide con los archivos (${ids.join(', ')})`);
}

process.exit(failed ? 1 : 0);
