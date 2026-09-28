# 档案 / Yet Another Homepage

An archive in the manner of a game's operator files. What is on file is what the owner chose to show, and what the visitor lived through here. The owner's way of seeing things is the physics of the clouds, never written down.

Open `index.html`.

Concept, writing and code: Claude (Anthropic), 2026, for Yan233_.

## The pages

Four pages in one frame: the bar with the time ledger, the rail with the struck page number, the foot. In browsers with cross-document View Transitions only the page slides; ← and → move between pages. The opt-in to the slide is an inline style in each page's head, because Chrome reads it as the body begins, often before `style.css` has arrived. The order is INDEX, SETTING, PROFILE, ELSEWHERE, so the file comes after the experience it holds.

- **Index.** The avatar reprinted as a 45° halftone in white, the hair's blue and the bangle's gold. A mouse is a lens over it: the dots under it swell and spread to about twice their size, the dots it sweeps past swing after it on springs, and a press sends a ring through the print. Every dot is tied to its own place and settles back, so the picture is never taken apart. A tap rings it on a phone, and the page still scrolls. The name is set as its owner writes it, `Yan233_`, with a and n as small capitals. The tag beside it carries the visit's number, which the receipt ends with.
- **Setting.** One cloud of 2,800 points takes six forms. The hand reaches into all of them alike: points part around it and follow its movement, a press holds, a click sends a ring. A thin ring follows a mouse, as wide as its reach. Each form keeps a law of its own:
  - DIAL (表盘): a hand sweeps the ring and writes down whatever shape the ring is in as it passes. Push the ring where the hand is about to go, and the dent is kept in gold, a little less each turn after.
  - EDDY (涡流): a hand moving round drives the band it crosses towards its own speed, and a still hand stills it. What was stirred keeps turning for a long while, spreading to the bands beside it.
  - SWELL (涌浪): five rings, never flat. The hand pushes each ring away from itself, and the waves run round and on into the neighbouring rings, slow to die down.
  - WEIGHT (份量): four holdings among loose dust. Holding one down gives it weight: the dust streams in, then some of the heaviest other holding. None is ever emptied.
  - EXCHANGE (往来): two bodies sending points to each other along arcs. What arrives is kept and answered with 1.3 times as much, new points drawn from what neither had yet, so both grow. Holding a body makes it send.
  - TWIN (双生): two arms wound together, half a turn apart. Push one round and the other follows to keep its distance. Take hold of one and it grows, and the other grows after it. Hold it long enough, and the page asks *And if one wins, then what?* The line is the only text in the setting that appears through use.

  Time here runs only while the page is in view. Each form is kept as it was left for the rest of the visit, so coming back finds it still turning.
- **Profile.** Only what the owner chose to show: the name, the alias, the motto as the signature line, and the portrait as file 00. The portrait is shown at its own 192 × 192, each pixel two or three wide. Every form of the setting that had at least three seconds of the visitor's time is filed after it, numbered in the order it was filed. Each file is a plate: a long exposure of every seventh point of that form, drawn as the line it travelled each frame and added up, light on dark. What the visitor did is in the plate. Under reduced motion the plate is a still of the form.
- **Elsewhere.** The doors. 00 is the owner's homepage, numbered as the cover and the portrait are, since 00 is the owner's own throughout. Then six, ACG first, ending with the texts, which live on the homepage too. Every door opens in a new tab, so the visit stays where it was. The receipt: GIVEN is the time; RECEIVED lists the pages and, line by line, each file with the time spent on it, printed below as a thermal printer would (one ink, an 8 × 8 ordered dither). Then *RECEIVED > GIVEN ?*, which only the visitor answers. The barcode is Code 128, set B, of `Yan233_` and the receipt's number. Its pattern table was checked structurally; it has not been scanned. The farewell sits under the doors, so it stays in view however long the receipt runs. The doors and the farewell open out smoothly with the window's height, so from 720 px up the farewell clears the foot without scrolling.

The lattice of the ground lights up blue around a mouse. Only a cover with a soft hole moves, by transform, so this costs no repaint.

## Writing

Nothing on the pages describes the owner. The words are the owner's own: the name, the alias, the motto and the links from the original homepage. The rest are names for what is on screen, the six forms, and the TWIN question noted above.

## Materials

- `avatar.avif`: the original site's 192 × 192 avatar. The halftone and the file are made from it whole. It is not split, deformed or recoloured; on the index, dots are displaced and spring back.
- The plates, prints and clouds are generated in the browser from the visitor's own input. No other images are used.

## Type

- `archivo.woff2` is Archivo, variable in width (62–125) and weight, under the SIL Open Font License 1.1 without a Reserved Font Name (`ARCHIVO-OFL.txt`). The source is `ofl/archivo/Archivo[wdth,wght].ttf` in [google/fonts](https://github.com/google/fonts), git blob `cc64253d36665a5ca0d6719cdf1e32b3de453b51`, subset to Basic Latin and a few marks. sha256 `4732b14f19098f1817ea3dbfdfe0c44821c4cfa25995e95bf632d3b419985373`.
- The name's small capitals are Archivo's capitals at its x-height (526 / 686 of the cap height), one weight heavier, with the A tucked under the Y by hand. Archivo has no small capitals of its own.
- `serif-sc.woff2` holds the twelve characters of the motto, from Noto Serif SC Bold 2.003 (a TTF with sha256 `9868e5845782ccce226e0941b7a5d1fea3b2520f7e59e6e62e89e02f132eb0ab`), under the SIL Open Font License 1.1 without a Reserved Font Name (`NOTO-SERIF-OFL.txt`). sha256 `ccceaa54738610f33ca3d4de0f2d426c1ca4f180d1f7400f6596949d1354c84c`.
- `sans-sc.woff2` is Noto Sans SC, variable in weight, subset to these pages' Chinese. SIL Open Font License 1.1 (`NOTO-SANS-OFL.txt`, checked identical to upstream git blob `1c9f43281b8f216c5461fe9ac729afbade7724e4`). The source is `ofl/notosanssc/NotoSansSC[wght].ttf` in [google/fonts](https://github.com/google/fonts), git blob `fb0637bafbcd804fe32152370a1225990745b4bc`. sha256 `66791f5f068e7400527af6793a03f39ecdde152d794691a23fbdc6a101e35cc1`.

The Archivo and Noto Sans SC sources were fetched through the GitHub API and checked with `git hash-object`. With the source fonts beside them, these commands reproduce the three files byte for byte (fontTools 4.57.0); rebuild the sans after changing the Chinese text:

```sh
python3 -m fontTools.subset 'Archivo[wdth,wght].ttf' \
  --unicodes='U+0020-007E,U+00A0,U+00A9,U+00B0,U+00B7,U+00D7,U+2013,U+2014,U+2019' \
  --layout-features='*' --flavor=woff2 --output-file=archivo.woff2
python3 -m fontTools.subset 'NotoSerifSC-Bold.ttf' --text='愿你的旅途满溢诅咒与祝福' \
  --layout-features='*' --flavor=woff2 --output-file=serif-sc.woff2
python3 -m fontTools.subset 'NotoSansSC[wght].ttf' \
  --text="$(python3 -c "import glob,re; t=''.join(re.sub(r'<[^>]+>','',open(f,encoding='utf-8').read()) for f in sorted(glob.glob('*.html')+glob.glob('*.js'))); print(''.join(sorted({c for c in t if ord(c)>=0x2E80})))")" \
  --layout-features='*' --flavor=woff2 --output-file=sans-sc.woff2
```

## Fallbacks

Without JavaScript, the index shows the avatar as a plain image. The setting lists its six forms with TWIN's line, the profile shows the portrait, and the receipt stands empty. With reduced motion, nothing moves: the halftone is still, each form is placed as it stands, and time spent with a form is still counted. A page brought back from the back/forward cache re-reads the visit, so the receipt and the files are current.

## Privacy

The visit is kept in `sessionStorage` for the tab's lifetime: the time, the pages, each form's state and time, the plates as JPEG data, and the answer. Nothing is sent anywhere, and no third-party request is made while reading; external links open only when followed. A full visit with all six plates takes about 0.6 M characters of storage. If storage is refused, the visit simply isn't kept.
