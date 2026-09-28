// Profile: what the owner chose to show, the name, the alias, the signature
// and the portrait, which is file 00. The files after it are the visitor's
// own: a plate for each form of the setting that had their time, numbered
// in the order they were filed.

import { NAMES, clock, filed, plates } from './site.js';

const list = document.querySelector('[data-files]');
const view = document.querySelector('[data-view]');
const plate = view.querySelector('.plate');
const field = (name) => view.querySelector(`[data-view="${name}"]`);

const portrait = { id: 'portrait', no: '00', han: '肖像', en: 'Portrait', with: '192 × 192', at: 'Yan233_' };
const nodes = new Map([['portrait', plate.querySelector('img')]]);
let files = [portrait];
let links = [];
let shown = 'portrait';
let layer = 0;

function node(file) {
  let image = nodes.get(file.id);
  if (!image) {
    image = Object.assign(new Image(), { alt: `${file.han} ${file.en}. ${file.with}.`, hidden: true });
    nodes.set(file.id, image);
    plate.append(image);
  }
  if (file.url && image.src !== file.url) image.src = file.url;
  return image;
}

// The file comes in over the last one, wiped from the left; the last one
// fades out under it.
function select(id, animate) {
  const file = files.find((f) => f.id === id) ?? portrait;
  shown = file.id;
  for (const link of links) link.setAttribute('aria-current', String(link.dataset.file === file.id));
  field('name').textContent = `File ${file.no} // ${file.en}`;
  field('han').textContent = file.han;
  field('with').textContent = file.with;
  field('at').textContent = file.at;
  const next = node(file);
  for (const image of nodes.values()) {
    if (image === next || image.hidden) continue;
    if (!animate) {
      image.hidden = true;
      continue;
    }
    image.classList.remove('arriving');
    image.classList.add('leaving');
    image.onanimationend = () => {
      image.hidden = true;
      image.classList.remove('leaving');
      image.onanimationend = null;
    };
  }
  next.onanimationend = null;
  next.classList.remove('leaving', 'arriving');
  next.hidden = false;
  next.style.zIndex = String(++layer);
  if (animate) {
    void next.offsetWidth;
    next.classList.add('arriving');
  }
}

function render() {
  files = [portrait];
  for (const [id, form] of filed()) {
    const url = plates.get(id);
    if (!url) continue;
    const no = String(files.length).padStart(2, '0');
    files.push({ id, no, han: NAMES[id][0], en: NAMES[id][1], time: clock(form.ms), with: `With ${clock(form.ms)}`, at: `Filed +${clock(form.at)}`, url });
  }

  list.replaceChildren(list.firstElementChild);
  for (const file of files.slice(1)) {
    const link = Object.assign(document.createElement('a'), { href: `#file-${file.no}` });
    link.dataset.file = file.id;
    link.append(
      Object.assign(document.createElement('b'), { textContent: file.no }),
      Object.assign(document.createElement('span'), { textContent: file.han }),
      Object.assign(document.createElement('small'), { textContent: file.en.toUpperCase() }),
      Object.assign(document.createElement('em'), { textContent: file.time }),
    );
    const item = document.createElement('li');
    item.append(link);
    list.append(item);
  }
  if (files.length === 1) {
    const none = Object.assign(document.createElement('li'), { className: 'none' });
    none.append(
      Object.assign(document.createElement('span'), { className: 'label', textContent: '未归档' }),
      Object.assign(document.createElement('span'), { className: 'label', textContent: 'Nothing filed yet' }),
    );
    list.append(none);
  }

  links = [...list.querySelectorAll('a')];
  for (const link of links) {
    link.onclick = (event) => {
      event.preventDefault();
      select(link.dataset.file, true);
      history.replaceState(null, '', link.hash);
    };
  }
}

render();
const initial = files.find((file) => location.hash === `#file-${file.no}`);
select(initial?.id ?? 'portrait', false);

addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  render();
  select(shown, false);
});
