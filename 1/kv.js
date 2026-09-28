// The avatar, reprinted as a halftone: a 45° screen of dots, sized by
// brightness, in white, in the blue of the hair and the gold of the bangle.
// A mouse is a lens over the print: the dots under it swell and spread, the
// ones it sweeps past swing after it, and a press sends a ring through the
// sheet. Every dot is a spring tied to its own place, so the picture always
// settles back as it was.

import { reduceMotion } from './site.js';

const canvas = document.querySelector('.kv');
const ctx = canvas.getContext('2d');
const SIZE = 192;
const INK = ['#eceef1', '#3a86ff', '#e2b33c'];

const image = new Image();
image.src = 'avatar.avif';
await image.decode();

// Per source pixel: brightness, which ink it prints in, and whether it is paper.
const source = document.createElement('canvas');
source.width = source.height = SIZE;
const sctx = source.getContext('2d', { willReadFrequently: true });
sctx.drawImage(image, 0, 0, SIZE, SIZE);
const rgba = sctx.getImageData(0, 0, SIZE, SIZE).data;
const value = new Float32Array(SIZE * SIZE);
const inks = new Uint8Array(SIZE * SIZE);
const paper = new Uint8Array(SIZE * SIZE);

for (let i = 0; i < SIZE * SIZE; i++) {
  const [r, g, b] = [rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max ? (max - min) / max : 0;
  const hue = max === min ? 0 : max === r ? ((g - b) / (max - min) + 6) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
  value[i] = max / 255;
  if (saturation > 0.35 && hue > 2.9 && hue < 4.4) inks[i] = 1;
  else if (saturation > 0.45 && hue > 0.45 && hue < 1.1) inks[i] = 2;
}

// The white ground is found by flooding in from the edges.
const flood = [];
for (let i = 0; i < SIZE; i++) flood.push(i, i * SIZE, i * SIZE + SIZE - 1, (SIZE - 1) * SIZE + i);
while (flood.length) {
  const p = flood.pop();
  if (paper[p] || Math.min(rgba[p * 4], rgba[p * 4 + 1], rgba[p * 4 + 2]) < 226) continue;
  paper[p] = 1;
  const x = p % SIZE;
  if (x > 0) flood.push(p - 1);
  if (x < SIZE - 1) flood.push(p + 1);
  if (p >= SIZE) flood.push(p - SIZE);
  if (p < SIZE * (SIZE - 1)) flood.push(p + SIZE);
}

// One entry per dot: its place, its size at rest and its ink; then the
// spring's offset from that place and its velocity.
let count = 0;
let hx, hy, size, ink, ox, oy, vx, vy;
let width = 0;
let height = 0;

function layout() {
  const rect = canvas.getBoundingClientRect();
  ratio = Math.min(devicePixelRatio || 1, 2);
  width = rect.width;
  height = rect.height;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  const cell = width < 600 ? 6.5 : 9;

  // The portrait fills the height and leans against the right edge.
  const scale = Math.max(height, width * 0.72) / SIZE;
  const left = width - SIZE * scale * 0.97;
  const top = height - SIZE * scale;

  const dots = [];
  const reach = Math.hypot(width, height);
  for (let u = -reach; u < reach; u += cell) {
    for (let v = -reach; v < reach; v += cell) {
      const x = (u - v) * Math.SQRT1_2 + width / 2;
      const y = (u + v) * Math.SQRT1_2 + height / 2;
      if (x < -cell || y < -cell || x > width + cell || y > height + cell) continue;
      const sx = Math.floor((x - left) / scale);
      const sy = Math.floor((y - top) / scale);
      if (sx < 0 || sy < 0 || sx >= SIZE || sy >= SIZE) continue;
      const i = sy * SIZE + sx;
      if (paper[i]) continue;
      const radius = (cell / 2) * Math.pow(value[i], 1.4) * 1.08;
      if (radius < 0.4) continue;
      dots.push(x, y, radius, inks[i]);
    }
  }
  count = dots.length / 4;
  hx = new Float32Array(count);
  hy = new Float32Array(count);
  size = new Float32Array(count);
  ink = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    hx[i] = dots[i * 4];
    hy[i] = dots[i * 4 + 1];
    size[i] = dots[i * 4 + 2];
    ink[i] = dots[i * 4 + 3];
  }
  ox = new Float32Array(count);
  oy = new Float32Array(count);
  vx = new Float32Array(count);
  vy = new Float32Array(count);
  nx = new Float32Array(count);
  ny = new Float32Array(count);
  nr = new Float32Array(count);
  px = new Float32Array(count);
  py = new Float32Array(count);
  pr = new Float32Array(count);
  moved = new Uint8Array(count);
  whole = true;
}

// Where each dot is to be drawn this frame (n) and where it was last drawn
// (p). Only the box around the dots that moved is cleared and drawn again.
let nx, ny, nr, px, py, pr, moved;
let whole = true;

// The lens: where the eased pointer is, how strongly it is held over the
// print, and how fast it is moving.
const LENS = 230;
const SWELL = 0.9; // magnification less one, at the lens's centre
const lens = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, on: false, amount: 0, pressed: false };

// A dot's spring: about a third of a second to come home, with one soft
// overshoot. The wake hands the lens's velocity to the dots it passes.
const OMEGA = 11;
const ZETA = 0.5;
const WAKE = 9;
const REACH = 90; // no dot is ever thrown further than this, in px

// Rings sent out by a press.
const RING = { speed: 1150, band: 70, life: 1.5, kick: 5200 };
const rings = [];

// Each dot is stamped from a ready-drawn disc rather than filled as a path,
// so a frame is one batch of small images. Discs come in four sizes, and a
// dot is cut from the nearest one above its size on screen, so its edge
// stays smooth.
const DISCS = [64, 32, 16, 8];
const sprites = INK.map((colour) => {
  const sheet = document.createElement('canvas');
  sheet.width = DISCS.reduce((sum, s) => sum + s, 0);
  sheet.height = DISCS[0];
  const s = sheet.getContext('2d');
  s.fillStyle = colour;
  let left = 0;
  for (const side of DISCS) {
    s.beginPath();
    s.arc(left + side / 2, side / 2, side / 2 - 1, 0, Math.PI * 2);
    s.fill();
    left += side;
  }
  return sheet;
});
const OFFSET = DISCS.map((_, k) => DISCS.slice(0, k).reduce((sum, s) => sum + s, 0));
let ratio = 1;

function stamp(k, x, y, radius) {
  const device = radius * ratio;
  const level = device > 16 ? 0 : device > 8 ? 1 : device > 4 ? 2 : 3;
  const side = DISCS[level];
  const half = (radius * side) / (side - 2);
  ctx.drawImage(sprites[k], OFFSET[level], 0, side, side, x - half, y - half, half * 2, half * 2);
}

const ENTRANCE = 1.6;
let entrance = reduceMotion.matches ? ENTRANCE : 0;

function step(dt, t) {
  entrance = Math.min(entrance + dt, ENTRANCE);
  const progress = entrance / ENTRANCE;

  // Ease the lens towards the pointer (about 50 ms) and in or out (about 160 ms).
  const follow = 1 - Math.exp(-dt / 0.05);
  const before = [lens.x, lens.y];
  lens.x += (lens.tx - lens.x) * follow;
  lens.y += (lens.ty - lens.y) * follow;
  const blend = 1 - Math.exp(-dt / 0.06);
  lens.vx += ((lens.x - before[0]) / dt - lens.vx) * blend;
  lens.vy += ((lens.y - before[1]) / dt - lens.vy) * blend;
  lens.amount += ((lens.on ? 1 : 0) - lens.amount) * (1 - Math.exp(-dt / 0.16));
  if (!lens.on && lens.amount < 0.002) lens.amount = 0;

  for (let k = rings.length - 1; k >= 0; k--) if (t - rings[k].t > RING.life) rings.splice(k, 1);

  const wake = WAKE * (lens.pressed ? 2 : 1) * lens.amount;
  let busy = progress < 1 || rings.length > 0 || Math.abs((lens.on ? 1 : 0) - lens.amount) > 0.002 || (lens.amount > 0 && Math.hypot(lens.tx - lens.x, lens.ty - lens.y) > 0.1);
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;

  for (let i = 0; i < count; i++) {
    let ax = -OMEGA * OMEGA * ox[i] - 2 * ZETA * OMEGA * vx[i];
    let ay = -OMEGA * OMEGA * oy[i] - 2 * ZETA * OMEGA * vy[i];

    // Lens: a smooth bulge around the pointer, and the wake of its movement.
    let x = hx[i];
    let y = hy[i];
    let grow = 1;
    if (lens.amount > 0) {
      const dx = hx[i] - lens.x;
      const dy = hy[i] - lens.y;
      const d = Math.hypot(dx, dy);
      if (d < LENS) {
        const u = d / LENS;
        const fall = (1 - u) * (1 - u);
        const push = d > 0.001 ? (LENS * SWELL * u * fall * lens.amount) / d : 0;
        x += dx * push;
        y += dy * push;
        grow += SWELL * fall * lens.amount;
        ax += wake * fall * (lens.vx - vx[i]);
        ay += wake * fall * (lens.vy - vy[i]);
      }
    }

    // Rings: a radial kick and a swelling as the front passes.
    for (const ring of rings) {
      const age = t - ring.t;
      const dx = hx[i] - ring.x;
      const dy = hy[i] - ring.y;
      const d = Math.hypot(dx, dy) || 1;
      const off = Math.abs(d - RING.speed * age);
      if (off > RING.band) continue;
      const strength = (1 - off / RING.band) * (1 - age / RING.life) ** 2;
      ax += (RING.kick * strength * dx) / d;
      ay += (RING.kick * strength * dy) / d;
      grow *= 1 + 0.9 * strength;
    }

    vx[i] += ax * dt;
    vy[i] += ay * dt;
    ox[i] += vx[i] * dt;
    oy[i] += vy[i] * dt;
    const off = Math.hypot(ox[i], oy[i]);
    if (off > REACH) {
      ox[i] *= REACH / off;
      oy[i] *= REACH / off;
    }
    if (!busy && (off > 0.05 || Math.abs(vx[i]) + Math.abs(vy[i]) > 1)) busy = true;

    // The entrance sweeps in from the right.
    const reveal = Math.min(Math.max(progress * 1.6 - (1 - hx[i] / width) * 0.6, 0), 1);
    const radius = size[i] * grow * reveal;
    nx[i] = x + ox[i];
    ny[i] = y + oy[i];
    nr[i] = radius < 0.3 ? 0 : radius;
    moved[i] = whole || Math.abs(nx[i] - px[i]) > 0.05 || Math.abs(ny[i] - py[i]) > 0.05 || Math.abs(nr[i] - pr[i]) > 0.02 ? 1 : 0;
    if (moved[i]) {
      left = Math.min(left, nx[i] - nr[i], px[i] - pr[i]);
      top = Math.min(top, ny[i] - nr[i], py[i] - pr[i]);
      right = Math.max(right, nx[i] + nr[i], px[i] + pr[i]);
      bottom = Math.max(bottom, ny[i] + nr[i], py[i] + pr[i]);
    }
  }

  if (whole) [left, top, right, bottom] = [0, 0, width, height];
  whole = false;
  if (left > right) return busy;
  // Out to whole device pixels, with a pixel to spare for the discs' soft edge.
  left = Math.floor((left - 1) * ratio) / ratio;
  top = Math.floor((top - 1) * ratio) / ratio;
  right = Math.ceil((right + 1) * ratio) / ratio;
  bottom = Math.ceil((bottom + 1) * ratio) / ratio;
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, right - left, bottom - top);
  ctx.clip();
  ctx.clearRect(left, top, right - left, bottom - top);
  for (let i = 0; i < count; i++) {
    const r = nr[i];
    const inside = r && nx[i] + r >= left && nx[i] - r <= right && ny[i] + r >= top && ny[i] - r <= bottom;
    if (inside) stamp(ink[i], nx[i], ny[i], r);
    if (inside || moved[i]) {
      px[i] = nx[i];
      py[i] = ny[i];
      pr[i] = r;
    }
  }
  ctx.restore();
  return busy;
}

let frame = 0;
let last = 0;
function loop(now) {
  frame = 0;
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (step(dt, now / 1000)) frame = requestAnimationFrame(loop);
  else last = 0;
}
function request() {
  if (!frame) frame = requestAnimationFrame(loop);
}

new ResizeObserver(() => {
  layout();
  request();
}).observe(canvas);

// The lens follows a mouse or a pen anywhere over the page; a touch only
// sends rings, so the page still scrolls under a finger.
const area = canvas.parentElement;
function aim(event) {
  const rect = canvas.getBoundingClientRect();
  lens.tx = event.clientX - rect.left;
  lens.ty = event.clientY - rect.top;
  if (lens.amount < 0.02) {
    lens.x = lens.tx;
    lens.y = lens.ty;
    lens.vx = lens.vy = 0;
  }
}
function ring(event) {
  const rect = canvas.getBoundingClientRect();
  rings.push({ x: event.clientX - rect.left, y: event.clientY - rect.top, t: performance.now() / 1000 });
  if (rings.length > 5) rings.shift();
  request();
}

area.addEventListener('pointermove', (event) => {
  if (reduceMotion.matches || event.pointerType === 'touch') return;
  aim(event);
  lens.on = true;
  request();
});
area.addEventListener('pointerleave', () => {
  lens.on = false;
  lens.pressed = false;
  request();
});
// A mouse rings on press; a finger on the tap's click, which only comes
// when the touch didn't turn into a scroll.
let touched = false;
area.addEventListener('pointerdown', (event) => {
  touched = event.pointerType === 'touch';
  if (touched || reduceMotion.matches || event.button !== 0 || event.target.closest('a, button')) return;
  lens.pressed = true;
  ring(event);
});
addEventListener('pointerup', () => {
  lens.pressed = false;
});
area.addEventListener('click', (event) => {
  if (touched && !reduceMotion.matches && !event.target.closest('a, button')) ring(event);
});
reduceMotion.addEventListener('change', () => {
  lens.on = false;
  rings.length = 0;
  entrance = ENTRANCE;
  whole = true;
  request();
});
