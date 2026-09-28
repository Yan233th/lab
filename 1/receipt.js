// The receipt: what the visit has given and received so far. Each file is a
// line, with the time spent on it, and is printed below as a thermal printer
// would print it. The barcode is Code 128 and scans to the owner's name as
// written and the receipt's number.

import { NAMES, clock, filed, onSecond, plates, record, save } from './site.js';

const field = (name) => document.querySelector(`[data-receipt="${name}"]`);
const buttons = [...document.querySelectorAll('.verdict button')];

field('no').textContent = `N° ${record.no}`;
field('date').textContent = new Date().toLocaleDateString('en-CA').replaceAll('-', '.');
onSecond((ms) => {
  field('time').textContent = clock(ms);
});

const received = field('received');
const prints = field('prints');

// One ink, in dots: the plate's light becomes the printer's black, through
// an 8 × 8 ordered dither. The plate's own dark ground prints as paper.
const BAYER = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];
const DOTS = 112;

async function print(url, no) {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = Object.assign(document.createElement('canvas'), { width: DOTS, height: DOTS });
  const c = canvas.getContext('2d', { willReadFrequently: true });
  c.drawImage(image, 0, 0, DOTS, DOTS);
  const pixels = c.getImageData(0, 0, DOTS, DOTS);
  const d = pixels.data;
  for (let i = 0; i < DOTS * DOTS; i++) {
    const light = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
    const ink = Math.pow(Math.max(light - 0.04, 0) / 0.96, 0.9);
    const threshold = (BAYER[((i / DOTS) & 7) * 8 + ((i % DOTS) & 7)] + 0.5) / 64;
    const dot = ink > threshold;
    d[i * 4] = dot ? 17 : 232;
    d[i * 4 + 1] = dot ? 19 : 233;
    d[i * 4 + 2] = dot ? 23 : 234;
    d[i * 4 + 3] = 255;
  }
  c.putImageData(pixels, 0, 0);
  const figure = document.createElement('figure');
  figure.append(canvas, Object.assign(document.createElement('figcaption'), { textContent: no }));
  return figure;
}

// The lines and prints are drawn from the visit as it stands; a page brought
// back from the back/forward cache draws them again.
async function render() {
  field('pages').textContent = `${record.pages.length} / 4`;
  const files = filed();
  received.replaceChildren(received.firstElementChild);
  files.forEach(([id, form], k) => {
    const name = document.createElement('dt');
    name.append(String(k + 1).padStart(2, '0'), Object.assign(document.createElement('span'), { textContent: NAMES[id][0] }), NAMES[id][1].toUpperCase());
    const line = document.createElement('div');
    line.append(name, Object.assign(document.createElement('dd'), { textContent: clock(form.ms) }));
    received.append(line);
  });
  const printed = await Promise.all(
    files.map(([id], k) => {
      const url = plates.get(id);
      return url ? print(url, String(k + 1).padStart(2, '0')).catch(() => null) : null;
    }),
  );
  prints.replaceChildren(...printed.filter(Boolean));
  answer(record.answer);
}

addEventListener('pageshow', (event) => {
  if (event.persisted) render();
});

function answer(value) {
  buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.answer === value)));
}

for (const button of buttons) {
  button.addEventListener('click', () => {
    record.answer = record.answer === button.dataset.answer ? null : button.dataset.answer;
    answer(record.answer);
    save();
  });
}

// Code 128: bar and space widths for symbol values 0–106, in modules.
const PATTERNS = (
  '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 ' +
  '221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 ' +
  '221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 ' +
  '212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 ' +
  '231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 ' +
  '231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 ' +
  '314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 ' +
  '112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 ' +
  '111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 ' +
  '214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 ' +
  '114131 311141 411131 211412 211214 211232 2331112'
).split(' ');
const START_B = 104;
const STOP = 106;

function code128(text) {
  const values = [...text].map((char) => char.charCodeAt(0) - 32);
  const check = values.reduce((sum, v, i) => sum + v * (i + 1), START_B) % 103;
  return [START_B, ...values, check, STOP].map((v) => PATTERNS[v]).join('');
}

// Draw bars into the SVG, with the quiet zone the format asks for.
const svg = field('code');
const widths = [...code128(`Yan233_ ${record.no}`)].map(Number);
const quiet = 10;
const total = widths.reduce((sum, w) => sum + w, 0) + quiet * 2;
svg.setAttribute('viewBox', `0 0 ${total} 40`);
let at = quiet;
widths.forEach((w, i) => {
  if (i % 2 === 0) {
    const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bar.setAttribute('x', at);
    bar.setAttribute('width', w);
    bar.setAttribute('height', 40);
    svg.append(bar);
  }
  at += w;
});

await render();
