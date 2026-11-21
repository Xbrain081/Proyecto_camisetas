// Lee códigos QR del vídeo de la cámara y devuelve su texto y sus 4 esquinas.
//
// Usa BarcodeDetector (nativo, rápido) cuando el navegador lo soporta y, si no
// (por ejemplo Safari en iPhone), la librería jsQR incluida en js/vendor/.

const SCAN_WIDTH = 800; // jsQR trabaja sobre una copia reducida del fotograma (más ancho = lee QR más lejanos)
const INTERVAL_MS = 90;

/** @returns {Promise<null | ((video: HTMLVideoElement) => Promise<{text: string, corners: {x: number, y: number}[]}[]>)>} */
export async function createDetector() {
  if ('BarcodeDetector' in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes('qr_code')) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        return async (video) =>
          (await detector.detect(video)).map((code) => ({
            text: code.rawValue,
            corners: code.cornerPoints.map((p) => ({ x: p.x, y: p.y })),
          }));
      }
    } catch {
      // seguimos con jsQR
    }
  }

  if (typeof window.jsQR === 'function') {
    const scratch = document.createElement('canvas');
    const sctx = scratch.getContext('2d', { willReadFrequently: true });
    return async (video) => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return [];
      const scale = Math.min(1, SCAN_WIDTH / vw);
      scratch.width = Math.round(vw * scale);
      scratch.height = Math.round(vh * scale);
      sctx.drawImage(video, 0, 0, scratch.width, scratch.height);
      const { data } = sctx.getImageData(0, 0, scratch.width, scratch.height);
      const found = window.jsQR(data, scratch.width, scratch.height, { inversionAttempts: 'dontInvert' });
      if (!found) return [];
      const l = found.location;
      const corners = [l.topLeftCorner, l.topRightCorner, l.bottomRightCorner, l.bottomLeftCorner];
      return [{ text: found.data, corners: corners.map((p) => ({ x: p.x / scale, y: p.y / scale })) }];
    };
  }

  return null;
}

// ---- Movimiento de la cámara ----
// Cuando el QR sale de plano no se puede leer, pero sí podemos medir cuánto se ha movido
// la imagen entre dos muestras (desplazamiento global por comparación de bloques) y mover
// el personaje igual, como si siguiera clavado en el sitio donde estaba el QR.

const MOTION_W = 96;
const MOTION_H = 72;
const MOTION_RADIUS = 10; // desplazamiento máximo entre muestras (px de la miniatura)
const MOTION_MIN_CONTRAST = 0.8; // mejor/medio SAD: por encima de esto no hay textura fiable

/** @returns {(video: HTMLVideoElement) => {dx: number, dy: number} | null} desplazamiento en px de vídeo */
export function createMotionEstimator() {
  const canvas = document.createElement('canvas');
  canvas.width = MOTION_W;
  canvas.height = MOTION_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let previous = null;

  return (video) => {
    if (!video.videoWidth) return null;
    ctx.drawImage(video, 0, 0, MOTION_W, MOTION_H);
    const { data } = ctx.getImageData(0, 0, MOTION_W, MOTION_H);
    const gray = new Uint8Array(MOTION_W * MOTION_H);
    for (let i = 0; i < gray.length; i++) {
      gray[i] = (data[i * 4] * 77 + data[i * 4 + 1] * 150 + data[i * 4 + 2] * 29) >> 8;
    }
    const last = previous;
    previous = gray;
    if (!last) return null;

    const size = MOTION_RADIUS * 2 + 1;
    const scores = new Float32Array(size * size);
    let best = Infinity;
    let bestX = 0;
    let bestY = 0;
    let sum = 0;
    for (let sy = -MOTION_RADIUS; sy <= MOTION_RADIUS; sy++) {
      for (let sx = -MOTION_RADIUS; sx <= MOTION_RADIUS; sx++) {
        // Hipótesis: el contenido se movió (sx, sy). Compara solo la zona que se solapa.
        const x0 = Math.max(0, sx);
        const x1 = Math.min(MOTION_W, MOTION_W + sx);
        const y0 = Math.max(0, sy);
        const y1 = Math.min(MOTION_H, MOTION_H + sy);
        let sad = 0;
        let n = 0;
        for (let y = y0; y < y1; y += 2) {
          for (let x = x0; x < x1; x += 2) {
            sad += Math.abs(gray[y * MOTION_W + x] - last[(y - sy) * MOTION_W + (x - sx)]);
            n++;
          }
        }
        const score = n ? sad / n : Infinity;
        scores[(sy + MOTION_RADIUS) * size + (sx + MOTION_RADIUS)] = score;
        sum += score;
        if (score < best) {
          best = score;
          bestX = sx;
          bestY = sy;
        }
      }
    }
    if (best > (sum / scores.length) * MOTION_MIN_CONTRAST) return null; // sin textura: no fiable

    // Refinado por debajo del píxel con una parábola en cada eje.
    const at = (sx, sy) => scores[(sy + MOTION_RADIUS) * size + (sx + MOTION_RADIUS)];
    const refine = (a, b, c) => {
      const d = a - 2 * b + c;
      return d > 0 ? (a - c) / (2 * d) : 0;
    };
    const fx = Math.abs(bestX) < MOTION_RADIUS ? refine(at(bestX - 1, bestY), best, at(bestX + 1, bestY)) : 0;
    const fy = Math.abs(bestY) < MOTION_RADIUS ? refine(at(bestX, bestY - 1), best, at(bestX, bestY + 1)) : 0;

    return {
      dx: (bestX + fx) * (video.videoWidth / MOTION_W),
      dy: (bestY + fy) * (video.videoHeight / MOTION_H),
    };
  };
}

/**
 * Llama a onFrame(códigos, movimiento) unas ~10 veces por segundo.
 * "movimiento" es {dx, dy} en px de vídeo desde la muestra anterior, o null si no se pudo medir.
 * Devuelve una función para parar.
 */
export function startTracking(video, detect, onFrame, estimateMotion = null) {
  let alive = true;
  (async () => {
    while (alive) {
      const started = performance.now();
      try {
        if (video.readyState >= 2) {
          const motion = estimateMotion ? estimateMotion(video) : null;
          onFrame(await detect(video), motion);
        }
      } catch (err) {
        console.warn('Detección de QR:', err);
      }
      const spent = performance.now() - started;
      await new Promise((resolve) => setTimeout(resolve, Math.max(30, INTERVAL_MS - spent)));
    }
  })();
  return () => {
    alive = false;
  };
}
