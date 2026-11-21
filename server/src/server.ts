import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOCS_DIR, ID_PATTERN, listCharacterIds, readCharacter } from './characters.js';
import { publishCharacters } from './publish.js';
import { BASE_URL, characterUrl, qrBuffer } from './qr-image.js';
import { saveCharacter, ValidationError } from './store.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);
const ADMIN_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../admin');

// Este servidor guarda archivos y puede publicar en GitHub: solo atiende a esta máquina y solo a
// páginas servidas por él mismo (evita que otra web abierta en el navegador le mande órdenes).
const allowedHosts = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);
const allowedOrigins = new Set([...allowedHosts].map((h) => `http://${h}`));

app.use((req: Request, res: Response, next: NextFunction) => {
  if (!allowedHosts.has(req.headers.host ?? '')) {
    res.status(403).send('Host no permitido');
    return;
  }
  const origin = req.headers.origin;
  if (req.method !== 'GET' && req.method !== 'HEAD' && origin && !allowedOrigins.has(origin)) {
    res.status(403).send('Origen no permitido');
    return;
  }
  next();
});

app.use(express.json({ limit: '1mb' }));

const route =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

// ---- API ----
app.get('/api/config', (_req, res) => {
  res.json({ baseUrl: BASE_URL });
});

app.get(
  '/api/characters',
  route(async (_req, res) => {
    const ids = await listCharacterIds();
    const characters = await Promise.all(ids.map(readCharacter));
    res.json(characters.map(({ id, name }) => ({ id, name })));
  }),
);

app.get(
  '/api/characters/:id',
  route(async (req, res) => {
    if (!ID_PATTERN.test(req.params.id)) {
      res.status(400).json({ error: 'id no válido' });
      return;
    }
    try {
      res.json(await readCharacter(req.params.id));
    } catch {
      res.status(404).json({ error: 'personaje no encontrado' });
    }
  }),
);

// Crea o reemplaza un personaje.
app.post(
  '/api/characters',
  route(async (req, res) => {
    try {
      const c = await saveCharacter(req.body);
      res.json({ ok: true, id: c.id, name: c.name, url: characterUrl(c.id), qr: `/api/qr/${c.id}.png` });
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({ error: 'El personaje no es válido', details: err.details });
        return;
      }
      throw err;
    }
  }),
);

// QR (PNG) de un personaje, generado al momento.
app.get(
  '/api/qr/:id.png',
  route(async (req, res) => {
    const { id } = req.params;
    if (!ID_PATTERN.test(id)) {
      res.status(400).json({ error: 'id no válido' });
      return;
    }
    res.type('png').send(await qrBuffer(id));
  }),
);

// Sube a GitHub los personajes nuevos o modificados.
app.post(
  '/api/publish',
  route(async (_req, res) => {
    try {
      res.json(await publishCharacters());
    } catch (err) {
      const message = (err as { stderr?: string; message: string }).stderr || (err as Error).message;
      res.status(500).json({ error: `No se pudo publicar: ${message.trim()}` });
    }
  }),
);

// ---- Archivos ----
app.use('/admin', express.static(ADMIN_DIR)); // panel para subir personajes
app.use(express.static(DOCS_DIR)); // el frontend, para desarrollo local

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno' });
});

// Solo localhost: el panel puede escribir en disco y publicar.
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Camisetas AR:  http://localhost:${PORT}`);
  console.log(`Panel de personajes:  http://localhost:${PORT}/admin/`);
});
