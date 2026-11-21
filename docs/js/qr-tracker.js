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

/** Llama a onFrame(códigos) unas ~10 veces por segundo. Devuelve una función para parar. */
export function startTracking(video, detect, onFrame) {
  let alive = true;
  (async () => {
    while (alive) {
      const started = performance.now();
      try {
        if (video.readyState >= 2) onFrame(await detect(video));
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
