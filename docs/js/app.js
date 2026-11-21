import { buildSprites } from './sprite.js';
import { IsoScene, SCENE_W, SCENE_H, ANCHOR } from './iso.js';
import { createDetector, startTracking } from './qr-tracker.js';

const $ = (id) => document.getElementById(id);
const video = $('camera');
const canvas = $('stage');
const ctx = canvas.getContext('2d');
const intro = $('intro');
const controls = $('controls');
const hint = $('hint');
const statusEl = $('status');

const ID_PATTERN = /^[a-z0-9-]+$/i;
const LOST_AFTER_MS = 1200; // sin ver el QR durante este tiempo se considera perdido
const PLATFORM_TO_QR = 2.5; // la plataforma mide 2,5 veces el QR en pantalla
const PLATFORM_ART_PX = 64; // ancho de la plataforma en píxeles de arte

const scene = new IsoScene();
const cache = new Map(); // id → { name, sprites }

const state = {
  id: null, // personaje mostrado
  loadingId: null,
  // Posición del centro de la plataforma en px CSS y tamaño de un píxel de arte (px CSS).
  cx: window.innerWidth / 2,
  cy: window.innerHeight * 0.6,
  unit: defaultUnit(),
  // Último QR visto, ya convertido a px CSS.
  target: null,
  lastSeen: -Infinity,
  stream: null,
  stopTracking: null,
  running: false,
  lastFrame: 0,
  hintText: '',
};

function defaultUnit() {
  return Math.min((window.innerWidth * 0.7) / PLATFORM_ART_PX, 8);
}

const anchored = () => performance.now() - state.lastSeen < LOST_AFTER_MS;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle('error', isError);
}

function setHint(text) {
  if (text === state.hintText) return;
  state.hintText = text;
  hint.textContent = text;
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

// ---- Personajes ----
async function loadCharacter(id) {
  if (!cache.has(id)) {
    const data = await loadJSON(`characters/${id}.json`);
    cache.set(id, { name: data.name, sprites: buildSprites(data) });
  }
  return cache.get(id);
}

async function showCharacter(id) {
  if (id === state.id || id === state.loadingId) return;
  state.loadingId = id;
  try {
    const { name, sprites } = await loadCharacter(id);
    scene.setSprites(sprites);
    state.id = id;
    $('title').textContent = name;
  } catch (err) {
    console.warn(err);
  } finally {
    state.loadingId = null;
  }
}

/** Un QR de camiseta es una URL del tipo https://…/?c=001 */
function characterIdFromQr(text) {
  try {
    const id = new URL(text).searchParams.get('c');
    return id && ID_PATTERN.test(id) ? id : null;
  } catch {
    return null;
  }
}

// ---- Seguimiento del QR ----
// El vídeo se muestra con object-fit: cover; hay que convertir sus coordenadas a las de pantalla.
function videoToScreen(p) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const s = Math.max(window.innerWidth / vw, window.innerHeight / vh);
  return { x: p.x * s + (window.innerWidth - vw * s) / 2, y: p.y * s + (window.innerHeight - vh * s) / 2 };
}

function onCodes(codes) {
  for (const code of codes) {
    const id = characterIdFromQr(code.text);
    if (!id || code.corners.length < 4) continue;
    const c = code.corners.map(videoToScreen);
    const side = (Math.hypot(c[1].x - c[0].x, c[1].y - c[0].y) + Math.hypot(c[3].x - c[0].x, c[3].y - c[0].y)) / 2;
    const first = !anchored();
    state.target = {
      x: c.reduce((sum, p) => sum + p.x, 0) / c.length,
      y: c.reduce((sum, p) => sum + p.y, 0) / c.length,
      unit: clamp((side * PLATFORM_TO_QR) / PLATFORM_ART_PX, 1.5, 40),
    };
    state.lastSeen = performance.now();
    if (first) Object.assign(state, { cx: state.target.x, cy: state.target.y, unit: state.target.unit });
    showCharacter(id);
    return;
  }
}

// ---- Dibujo ----
function frame(now) {
  if (!state.running) return;
  const dt = Math.min(0.1, (now - state.lastFrame) / 1000 || 0);
  state.lastFrame = now;

  if (anchored() && state.target) {
    // Suavizado para que el personaje siga al QR sin temblar.
    const k = 0.35;
    state.cx += (state.target.x - state.cx) * k;
    state.cy += (state.target.y - state.cy) * k;
    state.unit += (state.target.unit - state.unit) * k;
  }

  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (state.id) {
    scene.update(dt);
    const u = Math.max(1, Math.round(state.unit * dpr));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      scene.render(),
      Math.round(state.cx * dpr - ANCHOR.x * u),
      Math.round(state.cy * dpr - ANCHOR.y * u),
      SCENE_W * u,
      SCENE_H * u,
    );
  }

  if (anchored()) setHint('Anclado al QR · muévete con calma');
  else if (state.id) setHint('Apunta al QR de la camiseta para anclarlo · arrastra para mover');
  else setHint('Apunta al QR de tu camiseta');

  requestAnimationFrame(frame);
}

// ---- Gestos (solo cuando no hay QR anclado): arrastrar y pellizcar ----
const pointers = new Map();
let pinchStart = null;
const pinchDist = () => {
  const [a, b] = [...pointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y) || 1;
};

canvas.addEventListener('pointerdown', (e) => {
  if (anchored()) return;
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) pinchStart = { dist: pinchDist(), unit: state.unit };
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p || anchored()) return;
  if (pointers.size === 1) {
    state.cx = clamp(state.cx + (e.clientX - p.x), 0, window.innerWidth);
    state.cy = clamp(state.cy + (e.clientY - p.y), 0, window.innerHeight);
  }
  p.x = e.clientX;
  p.y = e.clientY;
  if (pointers.size === 2 && pinchStart) {
    state.unit = clamp(pinchStart.unit * (pinchDist() / pinchStart.dist), 1.5, 40);
  }
});
const endPointer = (e) => {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchStart = null;
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener(
  'wheel',
  (e) => {
    if (!anchored()) state.unit = clamp(state.unit * (e.deltaY < 0 ? 1.1 : 0.9), 1.5, 40);
  },
  { passive: true },
);

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
  state.lastFrame = performance.now();
  requestAnimationFrame(frame);
}

function exit() {
  state.running = false;
  state.stopTracking?.();
  state.stopTracking = null;
  state.lastSeen = -Infinity;
  stopCamera();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  controls.hidden = true;
  hint.hidden = true;
  intro.hidden = false;
}

// ---- Foto: vídeo + escena ----
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

  const id = new URLSearchParams(location.search).get('c');

  if (id && !ID_PATTERN.test(id)) {
    setStatus('Código de personaje no válido.', true);
    return;
  }

  if (id) {
    try {
      const { name } = await loadCharacter(id);
      $('title').textContent = name;
      $('subtitle').textContent = 'Para anclarlo a tu camiseta, enfoca su QR con la cámara.';
      $('start').textContent = 'Activar cámara y ver personaje';
      $('start').hidden = false;
      await showCharacter(id);
    } catch {
      setStatus('No encontramos este personaje. Revisa el código de tu camiseta.', true);
    }
    return;
  }

  // Sin personaje en la URL: la página es el escáner.
  $('subtitle').textContent = 'Escanea el QR de tu camiseta dentro de esta página.';
  $('start').textContent = 'Abrir escáner de QR';
  $('start').hidden = false;

  try {
    const { characters } = await loadJSON('characters/index.json');
    $('pickerLabel').hidden = false;
    $('picker').hidden = false;
    $('picker').replaceChildren(
      ...characters.map((c) => {
        const a = document.createElement('a');
        a.href = `?c=${encodeURIComponent(c.id)}`;
        a.textContent = c.name;
        return a;
      }),
    );
  } catch (err) {
    console.warn(err);
  }
}

$('start').addEventListener('click', async () => {
  setStatus('Pidiendo acceso a la cámara…');
  let cameraOk = true;
  try {
    await startCamera();
  } catch (err) {
    cameraOk = false;
    console.warn(err);
  }

  if (!cameraOk && !state.id) {
    setStatus('Necesitamos la cámara para escanear el QR. Puedes probar un personaje de la lista.', true);
    return;
  }

  setStatus('');
  show();

  if (cameraOk) {
    const detect = await createDetector();
    if (detect) state.stopTracking = startTracking(video, detect, onCodes);
    else setHint('Este navegador no puede leer QR');
  }
});
$('shot').addEventListener('click', takePhoto);
$('reset').addEventListener('click', () => {
  state.lastSeen = -Infinity;
  Object.assign(state, { cx: window.innerWidth / 2, cy: window.innerHeight * 0.6, unit: defaultUnit() });
});
$('stop').addEventListener('click', exit);

init().catch((err) => setStatus(err.message, true));
