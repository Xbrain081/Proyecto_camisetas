const $ = (id) => document.getElementById(id);

const SYMBOLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const MAX_SIZE = 64;

let parsed = null; // { palette, frames, back, size }
let previewTimer = null;

// ---- Lectura del PNG ----
// Convierte una tira de fotogramas cuadrados en filas de texto, asignando una letra a cada color.
async function readStrip(file, palette) {
  const bitmap = await createImageBitmap(file, { colorSpaceConversion: 'none' });
  const size = bitmap.height;
  if (bitmap.width % size !== 0) {
    throw new Error(`${file.name}: el ancho (${bitmap.width}) debe ser múltiplo del alto (${size}); cada fotograma es un cuadrado.`);
  }
  if (size > MAX_SIZE) throw new Error(`${file.name}: cada fotograma puede medir como máximo ${MAX_SIZE}×${MAX_SIZE} px.`);

  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, size);

  const frames = [];
  for (let f = 0; f < canvas.width / size; f++) {
    const rows = [];
    for (let y = 0; y < size; y++) {
      let row = '';
      for (let x = 0; x < size; x++) {
        const i = (y * canvas.width + f * size + x) * 4;
        if (data[i + 3] < 128) {
          row += '.';
          continue;
        }
        const hex = '#' + [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
        if (!palette.has(hex)) {
          if (palette.size >= SYMBOLS.length) throw new Error(`Hay más de ${SYMBOLS.length} colores. Reduce la paleta.`);
          palette.set(hex, SYMBOLS[palette.size]);
        }
        row += palette.get(hex);
      }
      rows.push(row);
    }
    frames.push(rows);
  }
  return { frames, size };
}

async function parseFiles() {
  const front = $('front').files[0];
  const back = $('back').files[0];
  if (!front) return null;
  const palette = new Map();
  const f = await readStrip(front, palette);
  const b = back ? await readStrip(back, palette) : null;
  if (b && b.size !== f.size) throw new Error('Las dos tiras deben tener el mismo tamaño de fotograma.');
  return {
    palette: Object.fromEntries([...palette].map(([hex, symbol]) => [symbol, hex])),
    frames: f.frames,
    back: b?.frames ?? null,
    size: f.size,
  };
}

// ---- Vista previa ----
function drawFrame(canvas, rows, palette, zoom) {
  const size = rows.length;
  canvas.width = size * zoom;
  canvas.height = size * zoom;
  const ctx = canvas.getContext('2d');
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = palette[ch];
      ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
    }),
  );
}

function startPreview() {
  clearInterval(previewTimer);
  if (!parsed) return;
  const zoom = Math.max(2, Math.floor(160 / parsed.size));
  const fps = Math.min(30, Math.max(1, Number($('fps').value) || 6));
  let step = 0;
  const tick = () => {
    drawFrame($('pvFront'), parsed.frames[step % parsed.frames.length], parsed.palette, zoom);
    if (parsed.back) drawFrame($('pvBack'), parsed.back[step % parsed.back.length], parsed.palette, zoom);
    step++;
  };
  tick();
  previewTimer = setInterval(tick, 1000 / fps);
}

function setProblem(text) {
  $('problem').textContent = text;
}

function refreshSaveButton() {
  $('save').disabled = !(parsed && $('id').value.trim() && $('name').value.trim());
}

async function onFilesChange() {
  parsed = null;
  setProblem('');
  $('preview').hidden = true;
  try {
    parsed = await parseFiles();
  } catch (err) {
    setProblem(err.message);
  }
  if (parsed) {
    $('preview').hidden = false;
    $('pvBackBox').hidden = !parsed.back;
    $('pvInfo').textContent =
      `${parsed.size}×${parsed.size} px · ${parsed.frames.length} fotogramas de frente` +
      (parsed.back ? ` · ${parsed.back.length} de espaldas` : ' · sin vista de espaldas (se usará la de frente)') +
      ` · ${Object.keys(parsed.palette).length} colores`;
    startPreview();
  }
  refreshSaveButton();
}

// ---- Guardar ----
async function save() {
  const id = $('id').value.trim();
  if (knownIds.has(id) && !confirm(`Ya existe el personaje "${id}". ¿Reemplazarlo? Las camisetas con su QR mostrarán el arte nuevo.`)) return;

  const character = {
    id,
    name: $('name').value.trim(),
    fps: Math.min(30, Math.max(1, Number($('fps').value) || 6)),
    palette: parsed.palette,
    frames: parsed.frames,
    ...(parsed.back ? { back: parsed.back } : {}),
  };

  $('save').disabled = true;
  setProblem('');
  try {
    const res = await fetch('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(character),
    });
    const body = await res.json();
    if (!res.ok) throw new Error([body.error, ...(body.details ?? [])].join('\n'));

    $('qrImg').src = `${body.qr}?t=${Date.now()}`;
    $('qrDownload').href = body.qr;
    $('qrDownload').download = `qr-${body.id}.png`;
    $('rName').textContent = body.name;
    $('rUrl').textContent = body.url;
    $('result').hidden = false;
    $('result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    $('publishMsg').textContent = '';
    await loadList();
  } catch (err) {
    setProblem(err.message);
  } finally {
    refreshSaveButton();
  }
}

// ---- Publicar ----
async function publish() {
  $('publish').disabled = true;
  $('publishMsg').textContent = 'Publicando…';
  try {
    const res = await fetch('/api/publish', { method: 'POST' });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error);
    $('publishMsg').textContent = body.message;
  } catch (err) {
    $('publishMsg').textContent = err.message;
  } finally {
    $('publish').disabled = false;
  }
}

// ---- Lista ----
const knownIds = new Set();

async function loadList() {
  const res = await fetch('/api/characters');
  const characters = await res.json();
  knownIds.clear();
  characters.forEach((c) => knownIds.add(c.id));
  $('list').replaceChildren(
    ...characters.map((c) => {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = `${c.id} · ${c.name}`;
      const link = document.createElement('a');
      link.href = `/api/qr/${encodeURIComponent(c.id)}.png`;
      link.download = `qr-${c.id}.png`;
      link.textContent = 'Descargar QR';
      li.append(label, link);
      return li;
    }),
  );
  if (!$('id').value) {
    const numbers = [...knownIds].map((id) => Number(id)).filter((n) => Number.isInteger(n));
    $('id').placeholder = String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(3, '0');
  }
}

$('front').addEventListener('change', onFilesChange);
$('back').addEventListener('change', onFilesChange);
$('fps').addEventListener('input', startPreview);
$('id').addEventListener('input', refreshSaveButton);
$('name').addEventListener('input', refreshSaveButton);
$('save').addEventListener('click', save);
$('publish').addEventListener('click', publish);

loadList().catch((err) => setProblem(err.message));
