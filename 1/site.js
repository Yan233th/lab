// Shared by every page: the time ledger, the record of the visit, arrow keys
// between pages, the lit lattice under the pointer, and the entrance once the
// type has loaded. The `js` class is set by an inline script in each page's
// head, before the first paint; set here, the page would show its no-script
// layout first.

const root = document.documentElement;

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// One visit, kept for the tab's lifetime. Plates are images, so each has a
// key of its own and the record itself stays small.
const KEY = 'yan233-files';
const stored = (() => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
})();

export const record = {
  given: 0,
  pages: [],
  // Form id → { ms: time spent with it, at: time given when it was filed, state }.
  forms: {},
  answer: null,
  no: String(Math.floor(Math.random() * 1e6)).padStart(6, '0'),
  ...stored,
};

// Storage can be full or refused; the visit then simply isn't kept.
function put(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}

export function save() {
  settle();
  put(KEY, JSON.stringify(record));
}

export const plates = {
  get: (id) => {
    try {
      return sessionStorage.getItem(`${KEY}:plate:${id}`);
    } catch {
      return null;
    }
  },
  set: (id, url) => put(`${KEY}:plate:${id}`, url),
};

// The forms of the setting, as the profile and the receipt name them.
export const NAMES = {
  dial: ['表盘', 'Dial'],
  eddy: ['涡流', 'Eddy'],
  swell: ['涌浪', 'Swell'],
  weight: ['份量', 'Weight'],
  exchange: ['往来', 'Exchange'],
  twin: ['双生', 'Twin'],
};

// A form is on file once it has had this much of the visitor's time.
export const FILED = 3000;

export function filed() {
  return Object.entries(record.forms)
    .filter(([, form]) => form.ms >= FILED)
    .sort(([, a], [, b]) => a.at - b.at);
}

// Time is counted only while a page is actually in view.
let since = document.visibilityState === 'visible' ? performance.now() : null;

function settle() {
  if (since === null) return;
  const now = performance.now();
  record.given += now - since;
  since = now;
}

export function given() {
  return record.given + (since === null ? 0 : performance.now() - since);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    save();
    since = null;
  } else {
    since = performance.now();
  }
});
addEventListener('pagehide', save);

// A page brought back from the back/forward cache has an old copy of the
// visit; the other pages have added to it since. Pages that show the visit
// listen for the same event and draw it again.
addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  try {
    Object.assign(record, JSON.parse(sessionStorage.getItem(KEY)));
  } catch {}
  since = document.visibilityState === 'visible' ? performance.now() : null;
});

export function clock(ms) {
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':');
}

// A clock: redrawn on each whole second of time given.
const ledger = document.querySelector('[data-ledger]');
const listeners = new Set();
export function onSecond(listener) {
  listeners.add(listener);
  listener(given());
}
(function tick() {
  const ms = given();
  ledger.value = clock(ms);
  listeners.forEach((listener) => listener(ms));
  setTimeout(tick, 1000 - (ms % 1000));
})();

if (!record.pages.includes(document.body.dataset.page)) record.pages.push(document.body.dataset.page);
save();

// The visit has a number from its first page; the receipt ends with it.
for (const element of document.querySelectorAll('[data-visit]')) element.textContent = `N° ${record.no}`;

addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.target.closest?.('input, textarea, select, [contenteditable]')) return;
  const rel = { ArrowLeft: 'prev', ArrowRight: 'next' }[event.key];
  const link = rel && document.querySelector(`link[rel="${rel}"]`);
  if (link) location.href = link.href;
});

// The lattice lights up blue around a mouse. Only a cover with a soft hole
// in it moves, by transform, so following the pointer costs no repaint.
const glow = document.querySelector('.glow');
addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch' || reduceMotion.matches) return;
  glow.style.setProperty('--x', `${event.clientX}px`);
  glow.style.setProperty('--y', `${event.clientY}px`);
  glow.classList.add('on');
}, { passive: true });
document.addEventListener('pointerout', (event) => {
  if (!event.relatedTarget) glow.classList.remove('on');
});

await document.fonts.ready;
root.classList.add('ready');
