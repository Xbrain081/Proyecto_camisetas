// Convierte un personaje (JSON de texto) en canvases listos para dibujar.

export function buildFrames(character) {
  const { palette, frames } = character;
  return frames.map((rows) => {
    const h = rows.length;
    const w = rows[0].length;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === '.') return;
        const color = palette[ch];
        if (!color) return;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      });
    });
    return canvas;
  });
}
