import QRCode from 'qrcode';

export const BASE_URL = (process.env.BASE_URL ?? 'https://xbrain081.github.io/Proyecto_camisetas/').replace(/\/?$/, '/');

export const characterUrl = (id: string): string => `${BASE_URL}?c=${encodeURIComponent(id)}`;

// Corrección "M": menos módulos que con "H", así cada cuadradito es más grande en la tela
// y la cámara lo lee desde más lejos (importante para seguirlo en vivo).
export const qrBuffer = (id: string): Promise<Buffer> =>
  QRCode.toBuffer(characterUrl(id), { errorCorrectionLevel: 'M', margin: 4, scale: 16 });
