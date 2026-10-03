// The sheet: hand-coated paper, a negative made from the avatar, exposure
// that builds wherever the light rests, and the wash that fixes it in blue.
// Geometry is in paper pixels; the canvas shows the paper 1:1.

export const W = 960;
export const H = 1200;
export const PICTURE = { x: 180, y: 150, size: 600 };
export const E0 = 0.7; // light-seconds for 63% of full density
export const RADIUS = 110;
const REACH = Math.ceil(RADIUS * 1.6);
const SPAN = REACH * 2 + 1;
const REBATE = 30;

const PAPER = [243, 240, 231];
const SENSITIZER = [224, 218, 142];
const LATENT = [92, 108, 126];
const BRONZE = [138, 121, 86];
const MID = [56, 98, 158];
const DEEP = [12, 37, 86];

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Lookup tables over e = E / E0: latent density, bronzing, washed density.
const STEPS = 128;
const LIMIT = 16 * STEPS;
const LATENT_D = new Float32Array(LIMIT + 1);
const LATENT_B = new Float32Array(LIMIT + 1);
const WASHED_D = new Float32Array(LIMIT + 1);
for (let k = 0; k <= LIMIT; k++) {
  const e = k / STEPS;
  LATENT_D[k] = (1 - Math.exp(-e)) * 0.9;
  LATENT_B[k] = smooth(4, 10, e) * 0.4;
  WASHED_D[k] = (1 - Math.exp(-e)) * (1 - 0.22 * smooth(3, 9, e));
}
const lookup = (exposure) => Math.min(LIMIT, (exposure / E0) * STEPS) | 0;

// The light's falloff, precomputed for whole-pixel offsets from its centre.
const KERNEL = new Float32Array(SPAN * SPAN);
for (let y = -REACH; y <= REACH; y++) {
  for (let x = -REACH; x <= REACH; x++) {
    const r2 = (x * x + y * y) / (RADIUS * RADIUS);
    if (r2 < 2.56) KERNEL[(y + REACH) * SPAN + x + REACH] = Math.exp(-2.2 * r2);
  }
}

function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function surface(width = W, height = H) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// Smooth value noise over a cols × rows grid.
function noise(rand, cols, rows) {
  const grid = Float32Array.from({ length: (cols + 1) * (rows + 1) }, rand);
  return (u, v) => {
    const i = Math.min(cols - 1, Math.floor(u));
    const j = Math.min(rows - 1, Math.floor(v));
    const fu = u - i;
    const fv = v - j;
    const su = fu * fu * (3 - 2 * fu);
    const sv = fv * fv * (3 - 2 * fv);
    const a = grid[j * (cols + 1) + i];
    const b = grid[j * (cols + 1) + i + 1];
    const c = grid[(j + 1) * (cols + 1) + i];
    const d = grid[(j + 1) * (cols + 1) + i + 1];
    return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
  };
}

// Sensitizer brushed on in horizontal strokes, dry bristles at both ends.
function coating(rand) {
  const c = surface().getContext('2d', { willReadFrequently: true });
  const strokes = 12;
  const top = 72;
  const band = (904 - top) / strokes;
  for (let i = 0; i < strokes; i++) {
    const y0 = top + i * band - 20;
    const y1 = y0 + band + 40;
    const x0 = 84 + (rand() - 0.5) * 46;
    const x1 = 876 + (rand() - 0.5) * 52;
    c.globalAlpha = 0.8 + rand() * 0.15;
    c.beginPath();
    for (let x = x0; x <= x1; x += 24) c.lineTo(x, y0 + Math.sin(x / 61 + i) * 5 + (rand() - 0.5) * 4);
    for (let x = x1; x >= x0; x -= 24) c.lineTo(x, y1 + Math.sin(x / 53 - i) * 5 + (rand() - 0.5) * 4);
    c.closePath();
    c.fill();
    for (let k = 0; k < 26; k++) {
      const y = y0 + rand() * (y1 - y0);
      const h = 1 + rand() * 2.5;
      c.globalAlpha = 0.25 + rand() * 0.45;
      c.fillRect(x0 - rand() * 70, y, 30 + rand() * 70, h);
      c.fillRect(x1 - 30 - rand() * 40, y, 30 + rand() * 80, h);
    }
  }
  const alpha = c.getImageData(0, 0, W, H).data;
  const streak = noise(rand, 6, 24);
  const coat = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = alpha[(y * W + x) * 4 + 3] / 255;
      if (a) coat[y * W + x] = Math.min(1, a * 1.15) * (0.88 + 0.12 * streak((x / W) * 6, (y / H) * 24));
    }
  }
  return coat;
}

// Transmittance: 1 where no film lies, clear film base in the rebate with
// its edge markings, and the picture from the avatar, dense where it is light.
function negative(avatar) {
  const transmit = new Float32Array(W * H).fill(1);
  const { x: px, y: py, size } = PICTURE;
  for (let y = py - REBATE; y < py + size + REBATE; y++) transmit.fill(0.86, y * W + px - REBATE, y * W + px + size + REBATE);

  const marks = surface().getContext('2d', { willReadFrequently: true });
  marks.font = '600 17px Archivo, sans-serif';
  marks.textBaseline = 'middle';
  const above = py - REBATE / 2;
  const below = py + size + REBATE / 2;
  marks.fillText('YAN233_', px + 8, above);
  marks.textAlign = 'center';
  marks.fillText('2', px + size / 2, above);
  marks.fillText('192 × 192', px + size / 2, below);
  marks.textAlign = 'right';
  marks.fillText('▸ 2A', px + size - 8, above);
  marks.fillText('YAN233TH', px + size - 8, below);
  const ink = marks.getImageData(0, 0, W, H).data;
  for (let i = 0; i < W * H; i++) if (ink[i * 4 + 3] > 100) transmit[i] = 0.04;

  const picture = surface(size, size).getContext('2d', { willReadFrequently: true });
  picture.imageSmoothingQuality = 'high';
  picture.drawImage(avatar, 0, 0, size, size);
  const data = picture.getImageData(0, 0, size, size).data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const light = (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255;
      transmit[(py + y) * W + px + x] = 0.03 + 0.97 * (1 - light) ** 1.15;
    }
  }
  return transmit;
}

export class Sheet {
  constructor(avatar) {
    const rand = random(233);
    this.coat = coating(rand);
    this.transmit = negative(avatar);
    this.grain = Int8Array.from({ length: W * H }, () => Math.round((rand() - 0.5) * 9));
    this.exposure = new Float32Array(W * H);
    this.pixels = new ImageData(W, H);
  }

  reset() {
    this.exposure.fill(0);
  }

  coated(x, y) {
    const i = Math.round(y) * W + Math.round(x);
    return x >= 0 && y >= 0 && x < W && y < H && this.coat[i] > 0.2;
  }

  // What the wash will make of the patch under (x, y): density 0–1 and how
  // far into bronzing it is, 0–1. Averaged so it changes gradually.
  tone(x, y) {
    const cx = Math.round(x);
    const cy = Math.round(y);
    let sum = 0;
    let n = 0;
    for (let j = -8; j <= 8; j += 2) {
      for (let i = -8; i <= 8; i += 2) {
        const px = cx + i;
        const py = cy + j;
        if (px < 0 || py < 0 || px >= W || py >= H || this.coat[py * W + px] < 0.2) continue;
        sum += this.exposure[py * W + px];
        n++;
      }
    }
    if (!n) return null;
    const e = sum / n;
    return { density: WASHED_D[lookup(e)], bronze: smooth(3, 5.5, e / E0) };
  }

  // Adds `amount` light-seconds under a light centred at (x, y); returns the
  // rectangle that changed, or null.
  expose(x, y, amount) {
    const cx = Math.round(x);
    const cy = Math.round(y);
    const x0 = Math.max(0, cx - REACH);
    const y0 = Math.max(0, cy - REACH);
    const x1 = Math.min(W, cx + REACH + 1);
    const y1 = Math.min(H, cy + REACH + 1);
    if (x1 <= x0 || y1 <= y0) return null;
    for (let py = y0; py < y1; py++) {
      const row = (py - cy + REACH) * SPAN - cx + REACH;
      for (let px = x0; px < x1; px++) {
        const i = py * W + px;
        const k = KERNEL[row + px];
        if (k && this.coat[i]) this.exposure[i] += k * this.transmit[i] * amount;
      }
    }
    return [x0, y0, x1, y1];
  }

  paintLatent(context, [x0, y0, x1, y1] = [0, 0, W, H]) {
    const out = this.pixels.data;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = y * W + x;
        const c = this.coat[i];
        const k = lookup(this.exposure[i]);
        const d = LATENT_D[k] * c;
        const b = LATENT_B[k] * c;
        const g = this.grain[i];
        for (let ch = 0; ch < 3; ch++) {
          let v = PAPER[ch] + (SENSITIZER[ch] - PAPER[ch]) * c;
          v += (LATENT[ch] - v) * d;
          v += (BRONZE[ch] - v) * b;
          out[i * 4 + ch] = v + g;
        }
        out[i * 4 + 3] = 255;
      }
    }
    context.putImageData(this.pixels, 0, 0, x0, y0, x1 - x0, y1 - y0);
  }

  // The washed print: unexposed sensitizer gone, the rest Prussian blue.
  // Heavy overexposure washes slightly lighter, as cyanotype does.
  developed() {
    const canvas = surface();
    const context = canvas.getContext('2d');
    const image = context.createImageData(W, H);
    const out = image.data;
    for (let i = 0; i < W * H; i++) {
      const c = this.coat[i];
      const t = Math.round(Math.min(1, WASHED_D[lookup(this.exposure[i])] * c + 0.035 * c) * 1024) * 3;
      out[i * 4] = TONES[t] + this.grain[i];
      out[i * 4 + 1] = TONES[t + 1] + this.grain[i];
      out[i * 4 + 2] = TONES[t + 2] + this.grain[i];
      out[i * 4 + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    return canvas;
  }
}

// The washed colour at density d, 0–1.
export function printRGB(d) {
  const t = d < 0.5 ? d / 0.5 : (d - 0.5) / 0.5;
  const [from, to] = d < 0.5 ? [PAPER, MID] : [MID, DEEP];
  return from.map((v, k) => v + (to[k] - v) * t);
}

const TONES = new Float32Array(1025 * 3);
for (let k = 0; k <= 1024; k++) TONES.set(printRGB(k / 1024), k * 3);

export const BRONZE_RGB = [185, 154, 106];

// One frame of the wash: water poured from the top edge carries the latent
// print away and leaves the developed one behind it. `front` is where the
// water has reached, 0–1 of the sheet's height.
export function wash(context, latent, developed, front, time) {
  const y = front * (H + 60) - 30;
  const edge = (x) => y + Math.sin(x / 47 + time * 5) * 9 + Math.sin(x / 13 - time * 8) * 3;
  context.drawImage(latent, 0, 0);
  context.save();
  context.beginPath();
  context.moveTo(0, 0);
  for (let x = 0; x <= W; x += 16) context.lineTo(x, edge(x));
  context.lineTo(W, 0);
  context.closePath();
  context.clip();
  context.drawImage(developed, 0, 0);
  context.globalAlpha = 0.35;
  context.drawImage(latent, 0, Math.max(0, y - 46), W, 46, 0, Math.max(0, y - 40), W, 46);
  context.restore();
  context.beginPath();
  for (let x = 0; x <= W; x += 16) context.lineTo(x, edge(x));
  context.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  context.lineWidth = 2;
  context.stroke();
}

// Pencil under the image, as a print is signed: edition, title, name,
// and the exposure it took.
export function inscribe(context, { no, exposure, date }) {
  context.save();
  context.fillStyle = 'rgba(64, 64, 68, 0.8)';
  context.textBaseline = 'alphabetic';
  context.font = '400 26px Archivo, sans-serif';
  context.textAlign = 'left';
  context.fillText('1/1', 120, 1010);
  context.textAlign = 'right';
  context.font = '500 27px Archivo, sans-serif';
  context.fillText('Yan233_', 840, 1010);
  context.textAlign = 'center';
  context.font = '400 30px "Serif SC", serif';
  context.fillText('愿你的旅途满溢诅咒与祝福', 480, 1010);
  context.font = '400 17px Archivo, sans-serif';
  context.fillStyle = 'rgba(64, 64, 68, 0.6)';
  context.fillText(`N° ${no}    EXP ${exposure}    ${date}`, 480, 1052);
  context.restore();
}
