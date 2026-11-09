// Little side-view capybaras for the live map, drawn once into offscreen
// canvases and stamped hundreds of times per frame. Walking capybaras
// waddle (two frames), seated ones tuck their legs in. Rerouted capybaras
// wear a yuzu; capybaras waiting at a full door get a speech bubble.
export type SpriteKind = 'normal' | 'rerouted' | 'waiting';
/** Frames 0 and 1 are the waddle; 2 is sitting. */
export type SpriteFrame = 0 | 1 | 2;
export const SIT: SpriteFrame = 2;

export const SPRITE_W = 36;
export const SPRITE_H = 30;
const SCALE = 4; // drawn at 4x for crisp scaling

const FUR = '#bb8659';
const FUR_LIGHT = '#cf9d70';
const DARK = '#8c5d3e';
const OUTLINE = 'rgba(84, 52, 32, 0.6)';
const INK = '#2a1b12';

function drawCapy(ctx: CanvasRenderingContext2D, frame: SpriteFrame, kind: SpriteKind) {
  ctx.save();
  ctx.scale(SCALE, SCALE);
  const sitting = frame === SIT;
  const bodyY = sitting ? 20.2 : 18.6;
  // a soft shadow keeps them on the floor
  ctx.fillStyle = 'rgba(58, 39, 25, 0.14)';
  ctx.beginPath();
  ctx.ellipse(16.5, 27.4, 12, 1.9, 0, 0, Math.PI * 2);
  ctx.fill();
  // legs: two frames for the waddle, tucked in when sitting
  ctx.fillStyle = DARK;
  if (sitting) {
    ctx.beginPath();
    ctx.roundRect(21.5, 24.6, 5.4, 2.8, 1.4);
    ctx.roundRect(6.5, 24.8, 5.4, 2.6, 1.3);
    ctx.fill();
  } else {
    const legs = frame === 0 ? [7.5, 12.5, 19, 24] : [9.2, 11.2, 20.6, 22.6];
    for (const x of legs) {
      ctx.beginPath();
      ctx.roundRect(x, 22.6, 2.9, 4.9, 1.3);
      ctx.fill();
    }
  }
  const body = () => {
    ctx.beginPath();
    ctx.ellipse(15.5, bodyY, 12, sitting ? 7.2 : 7.6, 0, 0, Math.PI * 2);
  };
  const head = () => {
    ctx.beginPath();
    ctx.roundRect(19.5, bodyY - 12.4, 14.4, 13.6, 5.8);
  };
  // outline first, so the two shapes read as one animal
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.5;
  body();
  ctx.stroke();
  head();
  ctx.stroke();
  ctx.fillStyle = FUR;
  body();
  ctx.fill();
  head();
  ctx.fill();
  // belly
  ctx.fillStyle = FUR_LIGHT;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.ellipse(13.5, bodyY + 3.2, 7.4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  const hy = bodyY - 12.4; // top of the head
  // the blunt muzzle
  ctx.fillStyle = DARK;
  ctx.beginPath();
  ctx.roundRect(29, hy + 4.4, 5.6, 7.6, 2.7);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(33.3, hy + 6.6, 0.6, 0, Math.PI * 2);
  ctx.fill();
  // ear
  ctx.fillStyle = DARK;
  ctx.beginPath();
  ctx.arc(22.6, hy + 0.9, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e0a887';
  ctx.beginPath();
  ctx.arc(22.8, hy + 1.2, 1.1, 0, Math.PI * 2);
  ctx.fill();
  // eye, with a spark
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(26.6, hy + 5.2, 1.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(27.1, hy + 4.6, 0.55, 0, Math.PI * 2);
  ctx.fill();
  // cheek
  ctx.fillStyle = 'rgba(241, 156, 156, 0.75)';
  ctx.beginPath();
  ctx.ellipse(25.4, hy + 8.8, 2, 1.25, 0, 0, Math.PI * 2);
  ctx.fill();
  if (kind === 'rerouted') {
    ctx.fillStyle = '#f6a623';
    ctx.strokeStyle = 'rgba(160, 96, 10, 0.7)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(26.4, hy - 2.2, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd98a';
    ctx.beginPath();
    ctx.arc(25.2, hy - 3.3, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6cbf5b';
    ctx.beginPath();
    ctx.ellipse(28.8, hy - 5.6, 2, 1, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (kind === 'waiting') {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e5604d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(4, 0.8, 10, 9.2, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e5604d';
    ctx.font = '900 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 9, 8.2);
  }
  ctx.restore();
}

export type SpriteSheet = Record<SpriteKind, [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement]>;

export function buildSprites(): SpriteSheet {
  const make = (frame: SpriteFrame, kind: SpriteKind) => {
    const c = document.createElement('canvas');
    c.width = SPRITE_W * SCALE;
    c.height = SPRITE_H * SCALE;
    drawCapy(c.getContext('2d')!, frame, kind);
    return c;
  };
  const kinds = (kind: SpriteKind): SpriteSheet[SpriteKind] => [make(0, kind), make(1, kind), make(SIT, kind)];
  return { normal: kinds('normal'), rerouted: kinds('rerouted'), waiting: kinds('waiting') };
}
