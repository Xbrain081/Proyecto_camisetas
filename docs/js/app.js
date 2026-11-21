import { buildFrames } from './sprite.js';

const $ = (id) => document.getElementById(id);
const video = $('camera');
const canvas = $('stage');
const ctx = canvas.getContext('2d');
const intro = $('intro');
const controls = $('controls');
const hint = $('hint');
const statusEl = $('status');

const state = {
  frames: [],
  fps: 2,
  unit: 14, // CSS px por píxel del sprite
  x: 0.5, // posición relativa (0..1)
  y: 0.62,
  stream: null,
  running: false,
};

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle('error', isError);
}

async function loadJSON(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`No se pudo cargar ${path} (${res.status})`);
  return res.json();
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
}

function draw(now) {
  if (!state.running) return;
  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;

  const frame = state.frames[Math.floor((now / 1000) * state.fps) % state.frames.length];
  const unit = Math.max(1, Math.round(state.unit * dpr));
  const w = frame.width * unit;
  const h = frame.height * unit;
  const bob = Math.round(Math.sin(now / 350) * 0.6) * unit;
  const px = Math.round(state.x * canvas.width - w / 2);
  const py = Math.round(state.y * canvas.height - h / 2) + bob;

  // sombra
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath();
  ctx.ellipse(px + w / 2, py + h - bob + unit * 0.5, w * 0.35, unit * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.drawImage(frame, px, py, w, h);
  requestAnimationFrame(draw);
}

// ---- Gestos: arrastrar y pellizcar ----
const pointers = new Map();
let pinchStart = null;

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) pinchStart = { dist: pinchDist(), unit: state.unit };
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  if (pointers.size === 1) {
    state.x = clamp(state.x + (e.clientX - p.x) / window.innerWidth, 0.05, 0.95);
    state.y = clamp(state.y + (e.clientY - p.y) / window.innerHeight, 0.1, 0.95);
  }
  p.x = e.clientX;
  p.y = e.clientY;
  if (pointers.size === 2 && pinchStart) {
    state.unit = clamp(pinchStart.unit * (pinchDist() / pinchStart.dist), 4, 40);
  }
});
const endPointer = (e) => {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchStart = null;
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => {
  state.unit = clamp(state.unit * (e.deltaY < 0 ? 1.1 : 0.9), 4, 40);
}, { passive: true });

function pinchDist() {
  const [a, b] = [...pointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y) || 1;
}
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// ---- Cámara ----
async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este navegador no permite usar la cámara (se necesita HTTPS).');
  }
  state.stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  });
  video.srcObject = state.stream;
  await video.play();
}

function stopCamera() {
  state.stream?.getTracks().forEach((t) => t.stop());
  state.stream = null;
  video.srcObject = null;
}

function show() {
  intro.hidden = true;
  controls.hidden = false;
  hint.hidden = false;
  state.running = true;
  requestAnimationFrame(draw);
}

function exit() {
  state.running = false;
  stopCamera();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  controls.hidden = true;
  hint.hidden = true;
  intro.hidden = false;
}

// ---- Foto: vídeo + personaje ----
function takePhoto() {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const c = out.getContext('2d');
  if (video.videoWidth) {
    // equivalente a object-fit: cover
    const s = Math.max(out.width / video.videoWidth, out.height / video.videoHeight);
    const w = video.videoWidth * s;
    const h = video.videoHeight * s;
    c.drawImage(video, (out.width - w) / 2, (out.height - h) / 2, w, h);
  } else {
    c.fillStyle = '#14121f';
    c.fillRect(0, 0, out.width, out.height);
  }
  c.drawImage(canvas, 0, 0);
  out.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `camiseta-ar-${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
}

// ---- Arranque ----
async function init() {
  resize();
  window.addEventListener('resize', resize);

  const params = new URLSearchParams(location.search);
  const id = params.get('c');

  if (!id) {
    const { characters } = await loadJSON('characters/index.json');
    $('picker').hidden = false;
    $('picker').replaceChildren(
      ...characters.map((c) => {
        const a = document.createElement('a');
        a.href = `?c=${encodeURIComponent(c.id)}`;
        a.textContent = c.name;
        return a;
      }),
    );
    $('subtitle').textContent = 'Elige un personaje (o escanea el código de tu camiseta).';
    return;
  }

  if (!/^[a-z0-9-]+$/i.test(id)) {
    setStatus('Código de personaje no válido.', true);
    return;
  }

  try {
    const character = await loadJSON(`characters/${id}.json`);
    state.frames = buildFrames(character);
    state.fps = character.fps || 2;
    $('title').textContent = character.name;
    $('subtitle').textContent = 'Apunta la cámara a donde quieras verlo.';
    $('start').hidden = false;
  } catch {
    setStatus('No encontramos este personaje. Revisa el código de tu camiseta.', true);
  }
}

$('start').addEventListener('click', async () => {
  setStatus('Pidiendo acceso a la cámara…');
  try {
    await startCamera();
  } catch (err) {
    // Sin cámara seguimos mostrando el personaje sobre un fondo neutro.
    setStatus('');
    console.warn(err);
  }
  show();
});
$('shot').addEventListener('click', takePhoto);
$('reset').addEventListener('click', () => Object.assign(state, { x: 0.5, y: 0.62, unit: 14 }));
$('stop').addEventListener('click', exit);

init().catch((err) => setStatus(err.message, true));
