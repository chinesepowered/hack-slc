// Little side-view capybaras for the live map, drawn once into offscreen
// canvases and stamped hundreds of times per frame. Rerouted capybaras wear
// a yuzu; capybaras waiting at a full door get a speech bubble.
export type SpriteKind = 'normal' | 'rerouted' | 'waiting';

export const SPRITE_W = 34;
export const SPRITE_H = 28;
const SCALE = 3; // drawn at 3x for crisp scaling

function drawCapy(ctx: CanvasRenderingContext2D, frame: 0 | 1, kind: SpriteKind) {
  ctx.save();
  ctx.scale(SCALE, SCALE);
  const fur = '#b9845a';
  const dark = '#8c5d3e';
  // legs (two frames for the waddle)
  ctx.fillStyle = dark;
  const legY = 21;
  const legs = frame === 0 ? [7, 12, 18, 23] : [8.5, 10.5, 19.5, 21.5];
  for (const x of legs) {
    ctx.beginPath();
    ctx.roundRect(x, legY, 2.6, 4.5, 1.2);
    ctx.fill();
  }
  // body
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(15, 17, 11, 6.8, 0, 0, Math.PI * 2);
  ctx.fill();
  // head
  ctx.beginPath();
  ctx.roundRect(19.5, 7.5, 11.5, 10.5, 4.6);
  ctx.fill();
  // snout
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.roundRect(26.5, 11, 5.2, 6.2, 2.4);
  ctx.fill();
  // ear
  ctx.beginPath();
  ctx.arc(22.2, 8.2, 2.1, 0, Math.PI * 2);
  ctx.fill();
  // eye
  ctx.fillStyle = '#2a1b12';
  ctx.beginPath();
  ctx.arc(25.6, 11.4, 1.15, 0, Math.PI * 2);
  ctx.fill();
  // cheek
  ctx.fillStyle = 'rgba(241,156,156,0.6)';
  ctx.beginPath();
  ctx.ellipse(24.6, 14.4, 1.6, 1, 0, 0, Math.PI * 2);
  ctx.fill();
  if (kind === 'rerouted') {
    ctx.fillStyle = '#f6a623';
    ctx.beginPath();
    ctx.arc(24.5, 5, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6cbf5b';
    ctx.beginPath();
    ctx.ellipse(26.6, 2, 1.8, 0.9, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (kind === 'waiting') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e5604d';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.roundRect(1, 0.5, 9, 8, 2.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e5604d';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 5.5, 7);
  }
  ctx.restore();
}

export type SpriteSheet = Record<SpriteKind, [HTMLCanvasElement, HTMLCanvasElement]>;

export function buildSprites(): SpriteSheet {
  const make = (frame: 0 | 1, kind: SpriteKind) => {
    const c = document.createElement('canvas');
    c.width = SPRITE_W * SCALE;
    c.height = SPRITE_H * SCALE;
    drawCapy(c.getContext('2d')!, frame, kind);
    return c;
  };
  return {
    normal: [make(0, 'normal'), make(1, 'normal')],
    rerouted: [make(0, 'rerouted'), make(1, 'rerouted')],
    waiting: [make(0, 'waiting'), make(1, 'waiting')],
  };
}
