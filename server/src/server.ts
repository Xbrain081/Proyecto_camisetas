import express from 'express';
import { DOCS_DIR, ID_PATTERN, listCharacterIds, readCharacter } from './characters.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

// API de lectura de personajes (el prototipo en Pages usa los JSON estáticos directamente).
app.get('/api/characters', async (_req, res) => {
  const ids = await listCharacterIds();
  const characters = await Promise.all(ids.map(readCharacter));
  res.json(characters.map(({ id, name }) => ({ id, name })));
});

app.get('/api/characters/:id', async (req, res) => {
  if (!ID_PATTERN.test(req.params.id)) {
    res.status(400).json({ error: 'id no válido' });
    return;
  }
  try {
    res.json(await readCharacter(req.params.id));
  } catch {
    res.status(404).json({ error: 'personaje no encontrado' });
  }
});

// Sirve el frontend para desarrollo local.
app.use(express.static(DOCS_DIR));

app.listen(PORT, () => {
  console.log(`Camisetas AR en http://localhost:${PORT}`);
});
