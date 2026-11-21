// Convierte un personaje (JSON de texto) en canvases listos para dibujar.
//
// Un personaje tiene dos vistas:
//   frames → de frente (mira hacia la cámara)
//   back   → de espaldas (opcional; si falta se usa "frames")
// La escena isométrica espeja horizontalmente cada vista para los otros dos sentidos.

function rasterize(rows, palette) {
  const canvas = document.createElement('canvas');
  canvas.width = rows[0].length;
  canvas.height = rows.length;
  const ctx = canvas.getContext('2d');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = ch === '.' ? null : palette[ch];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    });
  });
  return canvas;
}

export function buildSprites(character) {
  const { palette, frames, back } = character;
  const front = frames.map((rows) => rasterize(rows, palette));
  return {
    front,
    back: back ? back.map((rows) => rasterize(rows, palette)) : front,
    fps: character.fps || 6,
  };
}
