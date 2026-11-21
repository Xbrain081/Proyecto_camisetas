import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { DOCS_DIR } from './characters.js';

const run = promisify(execFile);
const REPO_ROOT = path.resolve(DOCS_DIR, '..');

const git = (...args: string[]) =>
  run('git', args, {
    cwd: REPO_ROOT,
    timeout: 60_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, // si falla la autenticación, que falle en vez de colgarse
  });

/** Sube a GitHub los cambios de docs/characters (git add + commit + push). */
export async function publishCharacters(): Promise<{ published: boolean; message: string }> {
  const status = await git('status', '--porcelain', '--', 'docs/characters');
  if (!status.stdout.trim()) return { published: false, message: 'No hay cambios nuevos que publicar.' };

  await git('add', '--', 'docs/characters');
  await git('commit', '-m', 'Actualiza personajes desde el panel');
  await git('push', 'origin', 'HEAD');
  return { published: true, message: 'Publicado. GitHub Pages tardará 1–2 minutos en actualizarse.' };
}
