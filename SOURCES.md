# lab

The index of Yan233_'s lab, served at `lab.yan233.eu.org`. Open `index.html`.

## The page

A statement of the works held at the Lab, set out the way a bank or a broker sets out a statement: the issuer and the document at the head, the holder's information, a short letter, the works with their total, the Lab's terms, the signature, the important information and the foot. It is in the homepage's ink and paper, which swap at night. The only colour is the homepage's purple, on a link being pointed at. The page uses no script, and prints in the day's ink.

## Works

A work lives in a folder of its own, named by its number, and carries everything it uses. Works are numbered from 1, in the order they enter. A work enters the page as one row of the table:

```html
<tr>
  <td class="no">1</td>
  <th scope="row"><a href="1/" target="_blank">Title</a></th>
  <td class="date"><time datetime="YYYY-MM-DD">YYYY-MM-DD</time></td>
  <td class="size">Size</td>
</tr>
```

The first work replaces the row that says no works are held. With every work:

- the Total takes in its size;
- the statement date becomes the day of issue, in `datetime` and in words;
- Our ref. goes up by one: LAB/2026/002, and so on.

Size (KB) is the size of every file in the work's folder, added up, in units of 1,024 bytes and rounded:

```sh
find 1 -type f -printf '%s\n' | awk '{ s += $1 } END { printf "%d\n", s / 1024 + 0.5 }'
```

## Type

The page is set in the system's Helvetica or Arial, as statements are, and ships no font.

## Privacy

Nothing is stored or sent, and no third-party request is made.
