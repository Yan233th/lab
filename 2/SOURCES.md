# 蓝晒 / Cyanotype

A sheet of cyanotype paper and a negative made from Yan233_'s avatar. The visitor's pointer is the light: the picture forms only where it stays, and too long in one place bronzes the print. Nothing on the page explains this; the parts behave instead:

- The light glides after the hand. The underscore of the name is the only gauge. While the light is on the paper, the underscore takes the blue that spot will wash to, and turns bronze when the spot has had too much.
- The light may go a little past the sheet on every side, half its radius, and goes off softly further out. The veil over the sheet is larger than the sheet by that much, so it covers it wherever the light is. The lamp's hole in it closes with a plug, the hole's exact complement, which fades in and out. The room clips the lamp's glow at its edges, so the page never scrolls because of it.
- A darkroom timer without figures stands beside the sheet: one turn of the long hand is a minute of light on the coating. It runs only while the light is on the coating, its hand violet while it does, and it reads whichever print lies on the sheet. A print laid down from the wall swings it to that print's time. A fresh sheet sends it back to zero.
- Once something has been exposed, water rises above the top edge of the sheet with a glow of its own, and now and then a drop runs a little way down the paper. Drag it down and the wash follows the hand without ever going back up; let go, or press it, and it runs on by itself.
- The lights come up as a soft band of the lit room's ground running down the room, moved by transform alone. Each piece of type turns from light to dark as the middle of the band passes it, so no text fades out or sits grey on grey. A uniform crossfade of ground and type can't avoid a moment where both are equally bright. Secondary type is the ink at half strength rather than a grey of its own, so it turns with the ink and keeps part of its contrast over the band. The print is signed in pencil with the original motto, left to right.
- Once the lights are up, the stack of fresh sheets beside the paper gives another sheet, and the lights go down the same way. The finished print is hung below the stack.
- A hung print, clicked, comes down and lies over the sheet, a little askew, so the sheet shows underneath and is left as it was. Its place on the wall stays empty until it goes back: click it again, its empty place, or press Escape.
- The square beside the sheet, an arrow into a tray, downloads whichever print is on top. Hovering it lifts that print slightly.
- The sheet lies on a cutting mat with edge rulers, crop marks and registration targets, under a little grain. Where the lamp is, the mat around the sheet picks up its violet. The violet grid sits still under a cover with a soft hole in it, and only the cover moves (by transform), so following the light needs no repaint.

Concept, writing and code: Claude (Anthropic), 2026, for Yan233_.

## Materials

- Negative: `avatar.avif`, the original site's 192 × 192 avatar, used whole as a transmittance map. The picture is not redrawn, split or recoloured.
- Paper, coating, grain and exposure are procedural (`sheet.js`). No other image is used.
- The motto 愿你的旅途 / 满溢诅咒与祝福 and the names Yan233_ / Yan233th come from the original homepage.

## The process being simulated

Cyanotype (John Herschel, 1842): paper brushed with ferric ammonium citrate and potassium ferricyanide is yellow-green and sensitive to ultraviolet light. It is a printing-out process, so the image appears dimly during exposure. Washing in water removes the unexposed sensitizer and leaves Prussian blue where light reached. Heavy overexposure bronzes the surface and washes slightly lighter. Background: <https://en.wikipedia.org/wiki/Cyanotype>.

What the code does with that:

- Exposure per pixel accumulates light × film transmittance × time. Density after washing is `1 − e^(−E/E0)`, with a small loss beyond 3·E0. The light's falloff and these curves are lookup tables, so a frame costs a few milliseconds.
- Exposure is laid along the path the light travelled each frame, so fast strokes leave no gaps.
- Uncovered coating has no film over it, so it exposes fastest. That gives the solid blue, brush-edged border.
- The film's rebate carries edge markings (`YAN233_`, `2`, `▸ 2A`, `192 × 192`, `YAN233TH`). Being dense, they print white.
- The pencil records the time the light actually spent on coated paper.

## Type

- `archivo.woff2` is Archivo, variable in width (62–125) and weight, under the SIL Open Font License 1.1 without a Reserved Font Name (`ARCHIVO-OFL.txt`). The source is `ofl/archivo/Archivo[wdth,wght].ttf` in [google/fonts](https://github.com/google/fonts), git blob `cc64253d36665a5ca0d6719cdf1e32b3de453b51`, fetched through the GitHub API and checked with `git hash-object`, and subset to Basic Latin and a few marks. sha256 `4732b14f19098f1817ea3dbfdfe0c44821c4cfa25995e95bf632d3b419985373`; with the source beside it, this reproduces it byte for byte (fontTools 4.57.0):

  ```sh
  python3 -m fontTools.subset 'Archivo[wdth,wght].ttf' \
    --unicodes='U+0020-007E,U+00A0,U+00A9,U+00B0,U+00B7,U+00D7,U+2013,U+2014,U+2019' \
    --layout-features='*' --flavor=woff2 --output-file=archivo.woff2
  ```

- The name is set with its lower-case letters as small capitals. Archivo has none, so they are its capitals at its x-height (0.767 of the cap height), one weight heavier to keep the strokes even. The A is moved under the Y's arm by hand, since kerning doesn't reach across the span.
- `serif-sc.woff2` is a subset of Noto Serif CJK SC Regular 2.003, taken from Debian's `fonts-noto-cjk` 1:20240730+repack1-1 (`/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc`, face index 2) with fontTools 4.57.0. License: SIL OFL 1.1, see `NOTO-CJK-OFL.txt`. sha256 `05e29d4b5ca208e1261d0b24e0d13c47f8b802691e7c28b325340903d7210489`.

The serif subset covers every character above U+2000 in `index.html`, `app.js` and `sheet.js` except the ▸ on the film's edge, which the edge markings draw in a sans-serif. This reproduces it byte for byte; run it again after changing the Chinese text:

```python
from fontTools import subset
from fontTools.ttLib import TTFont

text = ''.join(open(f, encoding='utf-8').read() for f in ('index.html', 'app.js', 'sheet.js'))
font = TTFont('/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc', fontNumber=2, recalcTimestamp=False)
options = subset.Options()
options.hinting = False
options.name_IDs = ['*']
subsetter = subset.Subsetter(options)
subsetter.populate(text=''.join(sorted({c for c in text if ord(c) > 0x2000})))
subsetter.subset(font)
font.flavor = 'woff2'
font.save('serif-sc.woff2')
```

## Privacy

Nothing is stored or sent. Prints exist as in-memory blobs until the tab closes, and downloads are generated in the browser.
