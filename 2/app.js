// The room: a light that glides after the hand over the paper, water that
// follows the hand down the sheet, and the prints hung beside it.

import { Sheet, W, H, RADIUS, wash, inscribe, printRGB, BRONZE_RGB } from './sheet.js';

const $ = (selector) => document.querySelector(selector);
const root = document.documentElement;
const body = document.body;
const room = $('.room');
const flood = $('.flood');
const stage = $('.stage');
const paper = $('.paper');
const canvas = paper.querySelector('canvas');
const context = canvas.getContext('2d');
const water = $('.water');
const timer = $('.timer');
const laid = $('.laid');
const take = $('.take');
const stack = $('.stack');
const hung = $('[data-prints]');
const tail = $('.name .tail');
const status = $('[data-status]');
const themed = [...document.querySelectorAll('.name, .title, .timer, .caption, .take, .credit')]; // what turns with the lights
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const pad = (n) => String(n).padStart(2, '0');
const hms = (s) => [Math.floor(s / 3600), Math.floor(s / 60) % 60, Math.floor(s) % 60].map(pad).join(':');
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
};
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp = (v) => Math.min(1, Math.max(0, v));
// Share of the remaining distance to cover this frame, for a time constant tau.
const ease = (dt, tau) => (reduceMotion.matches ? 1 : 1 - Math.exp(-dt / tau));

let sheet;
let state = 'dark';
let exposure = 0;
let hand = null; // where the hand is over the paper, in paper px
let light = null; // where the light is; it follows the hand
let keyLight = { x: W / 2, y: 450 };
const SPILL = RADIUS / 2; // how far past the sheet's edges the light may go, in paper px
let dialTarget = 0; // the seconds of light the timer should show
let dialShown = 0; // what it shows, easing towards that
let scale = 1; // CSS px per paper px
let origin = { x: 0, y: 0 }; // the sheet's top-left corner within the room
let pour = null; // the wash in progress
let writing = null; // the pencil going on
let print = null; // the finished sheet on the stage
let viewing = null; // a print from the wall, laid over the sheet
let sweep = null; // the lights changing
let frame = 0;
let last = 0;
let count = 0;
const VIOLET = [139, 108, 255];
const shown = { rgb: null }; // the underscore's colour as displayed

function setState(next) {
  state = next;
  body.dataset.state = next;
}

function request() {
  if (frame) return;
  last = performance.now();
  frame = requestAnimationFrame(step);
}

function union(a, b) {
  if (!a || !b) return a || b;
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

function copy(source) {
  const target = document.createElement('canvas');
  target.width = source.width;
  target.height = source.height;
  target.getContext('2d').drawImage(source, 0, 0);
  return target;
}

// One loop for everything that moves; it stops when nothing does.
function step(now) {
  frame = 0;
  const dt = Math.min(now - last, 50) / 1000;
  last = now;
  let busy = false;

  if (hand && state === 'dark') {
    const from = light ?? hand;
    const f = ease(dt, 0.045);
    light = { x: from.x + (hand.x - from.x) * f, y: from.y + (hand.y - from.y) * f };
    // Expose along the path the light travelled this frame, in short steps.
    const n = Math.max(1, Math.ceil(Math.hypot(light.x - from.x, light.y - from.y) / 12));
    let changed = null;
    for (let s = 1; s <= n; s++) {
      const t = s / n;
      changed = union(changed, sheet.expose(from.x + (light.x - from.x) * t, from.y + (light.y - from.y) * t, dt / n));
    }
    if (changed) sheet.paintLatent(context, changed);
    const coated = sheet.coated(light.x, light.y);
    if (coated) {
      exposure += dt;
      dialTarget = exposure;
      if (exposure >= 1.5 && water.hidden) water.hidden = false;
    }
    timer.classList.toggle('running', coated);
    paper.style.setProperty('--x', `${(light.x * scale).toFixed(1)}px`);
    paper.style.setProperty('--y', `${(light.y * scale).toFixed(1)}px`);
    room.style.setProperty('--lx', `${(origin.x + light.x * scale).toFixed(1)}px`);
    room.style.setProperty('--ly', `${(origin.y + light.y * scale).toFixed(1)}px`);

    // The underscore takes the blue this patch will wash to, bronze when overdone.
    const tone = sheet.tone(light.x, light.y);
    if (tone) {
      const target = mix(printRGB(tone.density), BRONZE_RGB, tone.bronze);
      shown.rgb = mix(shown.rgb ?? VIOLET, target, ease(dt, 0.15));
      tail.style.setProperty('--tone', `rgb(${shown.rgb.map(Math.round).join(' ')})`);
    }
    busy = true;
  }

  if (pour) {
    if (pour.auto) pour.target = reduceMotion.matches ? 1 : Math.min(1, pour.target + dt / 2.4);
    pour.front += (pour.target - pour.front) * ease(dt, 0.09);
    if (pour.target === 1 && pour.front > 0.998) pour.front = 1;
    wash(context, pour.latent, pour.developed, pour.front, now / 1000);
    if (pour.front === 1) finish();
    else busy = true;
  }

  if (writing) {
    writing.t = Math.min(1, writing.t + (reduceMotion.matches ? 1 : dt / 1.4));
    const width = Math.max(1, Math.round(W * (1 - (1 - writing.t) ** 2)));
    context.drawImage(writing.signed, 0, 960, width, 120, 0, 960, width, 120);
    if (writing.t < 1) busy = true;
    else writing = null;
  }

  if (dialShown !== dialTarget) {
    dialShown += (dialTarget - dialShown) * ease(dt, 0.12);
    if (Math.abs(dialTarget - dialShown) < 0.005) dialShown = dialTarget;
    timer.style.setProperty('--s', `${(dialShown * 6).toFixed(2)}deg`);
    timer.style.setProperty('--m', `${(dialShown * 0.1).toFixed(3)}deg`);
    if (dialShown !== dialTarget) busy = true;
  }

  if (sweep) {
    sweep.t = Math.min(1, sweep.t + (reduceMotion.matches ? 1 : dt / 1.4));
    const p = sweep.t * sweep.t * (3 - 2 * sweep.t);
    flood.firstElementChild.style.transform = `translateY(${((p - 1) * 100).toFixed(2)}%)`;
    // The type turns as the middle of the band passes it.
    const front = p * (innerHeight + sweep.band) - sweep.band / 2;
    for (const item of sweep.items) {
      if (!item.turned && item.y <= front) {
        item.el.dataset.lights = sweep.lights;
        item.turned = true;
      }
    }
    if (sweep.t === 1) settle();
    else busy = true;
  }

  if (busy && !frame) frame = requestAnimationFrame(step);
}

// --- The lights: they change by a band of the next room's ground that runs
// down the room, and the type turns as it passes, never left grey on grey ---

function lights(on) {
  if (sweep) settle();
  sweep = {
    t: 0,
    lights: on ? 'on' : 'off',
    band: innerHeight * 0.36,
    items: themed.map((el) => {
      const r = el.getBoundingClientRect();
      return { el, y: r.top + r.height / 2, turned: false };
    }),
  };
  flood.firstElementChild.style.transform = 'translateY(-100%)';
  flood.dataset.lights = sweep.lights;
  request();
}

function settle() {
  root.dataset.lights = sweep.lights;
  for (const { el } of sweep.items) delete el.dataset.lights;
  delete flood.dataset.lights;
  // Once the lights are up, the stack offers another sheet.
  if (sweep.lights === 'on' && state === 'lit') stack.disabled = false;
  sweep = null;
}

// --- The light ---------------------------------------------------------------

function toPaper(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: ((event.clientX - rect.left) / rect.width) * W, y: ((event.clientY - rect.top) / rect.height) * H };
}

// The light follows the hand over the sheet and a little past its edges,
// the same on every side; further out it goes off.
function follow(event) {
  const p = toPaper(event);
  if (p.x > -SPILL && p.x < W + SPILL && p.y > -SPILL && p.y < H + SPILL) aim(p);
  else release();
}

function aim(point) {
  if (state !== 'dark' || !sheet) return;
  // Coming onto the paper, the underscore eases from the lamp's violet.
  if (!hand) shown.rgb = null;
  hand = point;
  paper.classList.add('lit');
  room.classList.add('lamp-on');
  tail.classList.add('toned');
  body.classList.add('touched');
  request();
}

function release() {
  hand = null;
  paper.classList.remove('lit');
  room.classList.remove('lamp-on');
  tail.classList.remove('toned');
  timer.classList.remove('running');
}

paper.addEventListener('pointerenter', (event) => {
  if (event.pointerType === 'mouse') light = null;
});
paper.addEventListener('pointerdown', (event) => {
  if (state !== 'dark' || event.target === water) return;
  if (event.pointerType !== 'mouse') {
    paper.setPointerCapture(event.pointerId);
    light = null;
  }
  follow(event);
});
paper.addEventListener('pointermove', (event) => {
  if (pour && pour.pointer === event.pointerId) {
    const rect = canvas.getBoundingClientRect();
    pour.target = Math.max(pour.target, clamp((event.clientY - rect.top) / rect.height));
    return;
  }
  if (event.pointerType !== 'mouse' && !event.buttons) return;
  follow(event);
});
for (const type of ['pointerup', 'pointercancel']) {
  paper.addEventListener(type, (event) => {
    if (pour && pour.pointer === event.pointerId) {
      pour.pointer = null;
      pour.auto = true;
    } else if (event.pointerType !== 'mouse') release();
  });
}
paper.addEventListener('pointerleave', (event) => {
  if (event.pointerType === 'mouse') release();
});

// Keyboard: the light rests where the arrow keys leave it, and glides there.
paper.addEventListener('focus', () => {
  if (!hand && paper.matches(':focus-visible')) {
    light = null;
    aim({ ...keyLight });
  }
});
paper.addEventListener('blur', () => {
  if (!paper.matches(':hover')) release();
});
paper.addEventListener('keydown', (event) => {
  const move = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
  if (!move || state !== 'dark') return;
  event.preventDefault();
  const reach = event.shiftKey ? 96 : 32;
  keyLight = {
    x: Math.min(W - 40, Math.max(40, keyLight.x + move[0] * reach)),
    y: Math.min(H - 40, Math.max(40, keyLight.y + move[1] * reach)),
  };
  aim({ ...keyLight });
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) release();
});

const layout = new ResizeObserver(() => {
  scale = canvas.getBoundingClientRect().width / W;
  origin = { x: stage.offsetLeft + paper.offsetLeft, y: stage.offsetTop + paper.offsetTop };
  paper.style.setProperty('--lamp', `${(RADIUS * 3.2 * scale).toFixed(1)}px`);
  paper.style.setProperty('--spill', `${(SPILL * scale).toFixed(1)}px`);
  room.style.setProperty('--reach', `${(RADIUS * 7 * scale).toFixed(1)}px`);
  if (light) {
    paper.style.setProperty('--x', `${light.x * scale}px`);
    paper.style.setProperty('--y', `${light.y * scale}px`);
  }
});
layout.observe(canvas);
layout.observe(room);

// --- The wash: water follows the hand down the sheet, and never back up ------

function startPour(auto) {
  if (state !== 'dark' || water.hidden) return null;
  release();
  setState('washing');
  water.hidden = true;
  pour = { latent: copy(canvas), developed: sheet.developed(), front: 0, target: 0, auto, pointer: null };
  request();
  return pour;
}

water.addEventListener('pointerdown', (event) => {
  event.stopPropagation();
  if (!startPour(false)) return;
  pour.pointer = event.pointerId;
  paper.setPointerCapture(event.pointerId);
});
water.addEventListener('click', (event) => {
  if (event.detail === 0) startPour(true);
});

function finish() {
  const { developed } = pour;
  pour = null;
  context.drawImage(developed, 0, 0);
  const no = pad(++count);
  const record = { no, exposure: hms(exposure), date: today() };
  const signed = copy(developed);
  inscribe(signed.getContext('2d'), record);
  writing = { t: 0, signed };
  setState('lit');
  status.textContent = `N° ${no}, ${record.exposure}.`;

  const current = { no, signed, exposure, name: `yan233-cyanotype-${no}.png` };
  signed.toBlob((blob) => {
    current.url = URL.createObjectURL(blob);
    offer();
  }, 'image/png');
  print = current;
  offer();
  lights(true);
}

// Whichever print is on top is what the arrow beside the sheet takes away,
// and its time is what the timer reads.
function offer() {
  const top = viewing ?? print;
  take.hidden = !top;
  if (top?.url) {
    take.href = top.url;
    take.download = top.name;
  } else {
    take.removeAttribute('href');
  }
  dialTarget = viewing ? viewing.exposure : exposure;
  request();
}

// --- The wall: a hung print comes down and lies over the sheet for a look ----

const motion = { duration: 820, easing: 'cubic-bezier(0.2, 0.7, 0.1, 1)' };
const rest = () => getComputedStyle(laid).getPropertyValue('--rest').trim(); // how a laid print lies
const centres = (a, b) => `translate(${a.left + a.width / 2 - b.left - b.width / 2}px, ${a.top + a.height / 2 - b.top - b.height / 2}px) scale(${a.width / b.width}) rotate(0deg)`;

function lay(entry) {
  if (state === 'washing' || viewing === entry) return;
  putBack();
  viewing = entry;
  release();
  paper.inert = true;
  stage.classList.add('viewing');
  laid.querySelector('canvas').getContext('2d').drawImage(entry.signed, 0, 0);
  laid.hidden = false;
  entry.item.classList.add('out');
  entry.button.setAttribute('aria-pressed', 'true');
  offer();
  status.textContent = `N° ${entry.no} is on the sheet.`;
  if (!reduceMotion.matches) {
    const from = entry.button.getBoundingClientRect();
    laid.animate([{ transform: centres(from, paper.getBoundingClientRect()) }, { transform: rest() }], { ...motion, duration: 680 });
  }
  // On a narrow screen the sheet may be out of view; bring it in.
  stage.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'instant' : 'smooth' });
}

function putBack() {
  const entry = viewing;
  if (!entry) return;
  const from = paper.getBoundingClientRect();
  const focused = laid.contains(document.activeElement);
  viewing = null;
  laid.hidden = true;
  stage.classList.remove('viewing');
  paper.inert = false;
  entry.button.setAttribute('aria-pressed', 'false');
  if (focused) entry.button.focus({ preventScroll: true });
  offer();
  if (reduceMotion.matches) {
    entry.item.classList.remove('out');
    return;
  }
  // A copy of it flies back to its empty place on the wall.
  const ghost = copy(entry.signed);
  ghost.className = 'ghost';
  Object.assign(ghost.style, { position: 'absolute', left: `${from.left + scrollX}px`, top: `${from.top + scrollY}px`, width: `${from.width}px`, height: `${from.height}px`, zIndex: 5 });
  body.append(ghost);
  ghost.animate([{ transform: rest() }, { transform: centres(entry.button.getBoundingClientRect(), from) }], { ...motion, duration: 620 })
    .finished.then(() => {
      ghost.remove();
      if (viewing !== entry) entry.item.classList.remove('out');
    });
}

laid.addEventListener('click', putBack);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') putBack();
});

// --- Another sheet: the print is hung, a fresh sheet comes off the stack -----

stack.addEventListener('click', () => {
  if (state !== 'lit' || !print) return;
  const done = print;
  print = null;
  writing = null;
  context.drawImage(done.signed, 0, 0);
  const ghost = copy(canvas);

  const item = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', `N° ${done.no}`);
  button.setAttribute('aria-pressed', 'false');
  const thumb = document.createElement('canvas');
  thumb.width = 240;
  thumb.height = 300;
  thumb.getContext('2d').drawImage(done.signed, 0, 0, 240, 300);
  button.append(thumb);
  item.append(button);
  hung.prepend(item);
  Object.assign(done, { item, button });
  button.addEventListener('click', () => (viewing === done ? putBack() : lay(done)));
  // A print still out on the sheet goes back first, to its place as it now is.
  putBack();

  sheet.reset();
  sheet.paintLatent(context);
  exposure = 0;
  shown.rgb = null;
  offer();
  water.hidden = true;
  stack.disabled = true;
  setState('dark');
  lights(false);
  status.textContent = 'A new sheet.';

  if (reduceMotion.matches) return;
  const from = paper.getBoundingClientRect();
  const to = thumb.getBoundingClientRect();
  const pile = stack.getBoundingClientRect();
  Object.assign(ghost.style, { position: 'fixed', left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, transformOrigin: '0 0', zIndex: 5 });
  ghost.className = 'ghost';
  body.append(ghost);
  item.style.visibility = 'hidden';
  ghost.animate([{ transform: 'none' }, { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width})` }], motion)
    .finished.then(() => {
      ghost.remove();
      item.style.visibility = '';
    });
  paper.animate([
    { transform: `translate(${pile.left - from.left}px, ${pile.top - from.top}px) scale(${pile.width / from.width})`, opacity: 0.3 },
    { transform: 'none', opacity: 1 },
  ], { ...motion, delay: 120, fill: 'backwards' });
});

// --- Start ------------------------------------------------------------------

async function start() {
  const avatar = new Image();
  avatar.src = 'avatar.avif';
  await Promise.all([
    avatar.decode(),
    document.fonts.load('600 17px Archivo'),
    document.fonts.load('400 30px "Serif SC"', '愿你的旅途满溢诅咒与祝福'),
  ]);
  sheet = new Sheet(avatar);
  sheet.paintLatent(context);
  await document.fonts.ready;
  root.classList.add('ready');
}

start().catch(() => {
  root.classList.add('failed', 'ready');
  status.textContent = 'The negative could not be loaded.';
});
