// Escena isométrica estilo "Habbo": una plataforma de baldosas y un personaje que pasea.
//
// Todo se dibuja a 1 píxel de arte = 1 píxel del canvas interno (SCENE_W × SCENE_H) y
// luego app.js lo amplía con números enteros, así los píxeles quedan siempre nítidos.

export const GRID = 4; // baldosas por lado
const TILE_W = 16; // baldosa isométrica 2:1 → 16 × 8 px
const TILE_H = 8;
const THICK = 4; // grosor de la plataforma
export const SCENE_W = 96;
const HEIGHT = 72;
export const SCENE_H = HEIGHT;

// Esquina superior-izquierda de la baldosa (0,0) dentro del canvas interno.
const ORIGIN_X = 40;
const ORIGIN_Y = 24;

/** Punto del canvas interno que debe coincidir con el centro del QR (centro de la plataforma). */
export const ANCHOR = {
  x: ORIGIN_X + TILE_W / 2,
  y: ORIGIN_Y + TILE_H / 2 + ((GRID - 1) * TILE_H) / 2,
};

/** Opacidad de la plataforma (0–1): translúcida para que parezca virtual y deje ver el QR. */
export const FLOOR_ALPHA = 0.55;

const COLORS = {
  floorA: '#3b3558',
  floorB: '#4a4370',
  sideLeft: '#26223b',
  sideRight: '#1c1930',
  shadow: 'rgba(0,0,0,0.28)',
};

// Sentidos de marcha en el eje de la cuadrícula → hacia dónde se ve caminar en pantalla.
//   se: abajo-derecha (de frente) · sw: abajo-izquierda (de frente, espejado)
//   ne: arriba-derecha (de espaldas) · nw: arriba-izquierda (de espaldas, espejado)
const DIRS = { se: [1, 0], sw: [0, 1], nw: [-1, 0], ne: [0, -1] };
const DIR_NAMES = Object.keys(DIRS);
const SPEED = 1.5; // baldosas por segundo

const inBounds = (x, y) => x >= 0 && x < GRID && y >= 0 && y < GRID;

class Walker {
  constructor() {
    this.gx = 1;
    this.gy = 1;
    this.dir = 'se';
    this.target = null;
    this.wait = 0.6;
    this.walkTime = 0;
  }

  get moving() {
    return this.target !== null;
  }

  update(dt) {
    if (this.target) {
      this.walkTime += dt;
      const [dx, dy] = DIRS[this.dir];
      const step = SPEED * dt;
      const remaining = Math.abs(this.target.gx - this.gx) + Math.abs(this.target.gy - this.gy);
      if (step >= remaining) {
        this.gx = this.target.gx;
        this.gy = this.target.gy;
        this.target = null;
        // A veces sigue andando sin parar; otras veces descansa un momento.
        this.wait = Math.random() < 0.35 ? 0 : 0.4 + Math.random() * 1.6;
      } else {
        this.gx += dx * step;
        this.gy += dy * step;
      }
    } else {
      this.wait -= dt;
      if (this.wait <= 0) this.pickTarget();
    }
  }

  pickTarget() {
    const options = DIR_NAMES.filter((d) => inBounds(this.gx + DIRS[d][0], this.gy + DIRS[d][1]));
    const keep = options.includes(this.dir) && Math.random() < 0.6;
    const dir = keep ? this.dir : options[Math.floor(Math.random() * options.length)];
    this.dir = dir;
    this.target = { gx: this.gx + DIRS[dir][0], gy: this.gy + DIRS[dir][1] };
    this.walkTime = 0;
  }
}

// Rombo 2:1 sin antialiasing: filas de 4, 8, 12, 16, 16, 12, 8, 4 px.
function diamond(ctx, left, top, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < TILE_H; i++) {
    const w = (Math.min(i, TILE_H - 1 - i) + 1) * 4;
    ctx.fillRect(left + (TILE_W - w) / 2, top + i, w, 1);
  }
}

const tileLeft = (gx, gy) => ORIGIN_X + (gx - gy) * (TILE_W / 2);
const tileTop = (gx, gy) => ORIGIN_Y + (gx + gy) * (TILE_H / 2);

export class IsoScene {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = SCENE_W;
    this.canvas.height = SCENE_H;
    this.ctx = this.canvas.getContext('2d');
    // La plataforma se pinta opaca aquí y se compone con transparencia de una sola vez,
    // así no se ven costuras entre baldosas.
    this.floor = document.createElement('canvas');
    this.floor.width = SCENE_W;
    this.floor.height = SCENE_H;
    this.floorCtx = this.floor.getContext('2d');
    this.walker = new Walker();
    this.sprites = null;
  }

  setSprites(sprites) {
    this.sprites = sprites;
  }

  update(dt) {
    this.walker.update(dt);
  }

  render() {
    const { ctx } = this;
    ctx.clearRect(0, 0, SCENE_W, SCENE_H);
    this.floorCtx.clearRect(0, 0, SCENE_W, SCENE_H);
    this.drawFloor(this.floorCtx);
    ctx.globalAlpha = FLOOR_ALPHA;
    ctx.drawImage(this.floor, 0, 0);
    ctx.globalAlpha = 1;
    if (this.sprites) this.drawWalker();
    return this.canvas;
  }

  drawFloor(ctx) {
    // Laterales de la plataforma (solo las baldosas del borde que se ven de frente).
    for (let gx = 0; gx < GRID; gx++) {
      for (let gy = 0; gy < GRID; gy++) {
        const left = tileLeft(gx, gy);
        const top = tileTop(gx, gy);
        for (let t = 1; t <= THICK; t++) {
          if (gy === GRID - 1) diamond(ctx, left, top + t, COLORS.sideLeft);
          if (gx === GRID - 1) diamond(ctx, left, top + t, COLORS.sideRight);
        }
      }
    }
    // Baldosas, de atrás hacia delante.
    for (let sum = 0; sum <= (GRID - 1) * 2; sum++) {
      for (let gx = 0; gx < GRID; gx++) {
        const gy = sum - gx;
        if (gy < 0 || gy >= GRID) continue;
        diamond(ctx, tileLeft(gx, gy), tileTop(gx, gy), (gx + gy) % 2 ? COLORS.floorB : COLORS.floorA);
      }
    }
  }

  drawWalker() {
    const { ctx, walker, sprites } = this;
    const back = walker.dir === 'ne' || walker.dir === 'nw';
    const mirrored = walker.dir === 'sw' || walker.dir === 'nw';
    const frames = back ? sprites.back : sprites.front;
    const index = walker.moving ? Math.floor(walker.walkTime * sprites.fps) % frames.length : 0;
    const frame = frames[index];

    const cx = Math.round(tileLeft(walker.gx, walker.gy) + TILE_W / 2);
    const cy = Math.round(tileTop(walker.gx, walker.gy) + TILE_H / 2);
    const feetY = cy + 2;
    const bounce = walker.moving && index % 2 === 1 ? 1 : 0;

    ctx.fillStyle = COLORS.shadow;
    ctx.fillRect(cx - 5, feetY - 1, 10, 1);
    ctx.fillRect(cx - 3, feetY, 6, 1);

    const x = cx - Math.floor(frame.width / 2);
    const y = feetY - frame.height + 1 - bounce;
    if (mirrored) {
      ctx.save();
      ctx.translate(x + frame.width, y);
      ctx.scale(-1, 1);
      ctx.drawImage(frame, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(frame, x, y);
    }
  }
}
