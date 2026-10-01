---
name: taste review
colors:
  paper: "#F5F7F2"
  paper-2: "#EAECE7"
  ink: "#1E1E1E"
  ink-2: "#272726"
  void: "#111111"
  muted-on-paper: "#666562"
  muted-on-ink: "#959595"
  link: "#0000EE"
  drop: "#C4321A"
  drop-on-ink: "#FF4C24"
  rise-on-ink: "#8FA8FF"
typography:
  heading: { fontFamily: Figtree, fontWeight: 400 }
  body: { fontFamily: Figtree, fontWeight: 300 }
  label: { fontFamily: Azeret Mono, fontWeight: 400, fontSize: 13px }
rounded:
  sm: 4px
  md: 6px
  lg: 8px
---

# taste review · design system

The landing page follows the visual language the Taste Engine extracted from tastelabs.com (one full extraction, kept out of the repository in `.cache/`): two neutral surfaces that alternate, a light geometric sans, monospace labels, outlines instead of shadows, and one accent kept for what you can click. The wordmark, the copy and the layout are this project's own.

## Bands

The page is a stack of full-width bands, never a theme switch. A band sets `data-band` and every shadcn token inside it follows.

| Band    | Background | Type      | Used for                                                            |
| ------- | ---------- | --------- | ------------------------------------------------------------------- |
| `paper` | `#F5F7F2`  | `#1E1E1E` | Reading sections, the header, and the pull request comment specimen |
| `ink`   | `#1E1E1E`  | `#F5F7F2` | The hero, setup and the footer                                      |
| `void`  | `#111111`  | `#F5F7F2` | A section holding cards, which sit on `#1E1E1E`                     |

Bands alternate; two of the same tone never touch.

## Colour

- Greys carry all structure and type. Secondary text is `#666562` on paper and `#959595` on ink, both at least 4.5:1 on every surface they sit on (the extracted `#747370` and `#8B8B8B` fell short on the lighter one).
- Link blue `#0000EE` is the only accent and only on paper: it fails contrast on ink, where the accent turns paper white.
- `drop` and `rise` exist for the score change on a pull request and nothing else.
- Borders are 1px hairlines at 10% of the band's type colour.

## Type

- **Figtree** stands in for Matter, the reference's commercial face; the closest free geometric grotesk at the same light weights. Headings are 400, body 300.
- **Azeret Mono** is the free family the reference's Azeret Semimono comes from. It sets buttons, labels, numbers, paths and code, with ligatures off so `fi` stays two letters.
- Sizes are tokens in `globals.css` (`display`, `title`, `subtitle`, `body`, `small`, `label`, `tag`), each registered in `lib/utils.ts` so `cn` reads them as sizes.

## Components

- **Button**: mono label, 4px radius, 1px border, no shadow. `default` is filled with the band's type colour and inverts on hover; `outline` is the border alone and fills on hover; `ghost` and `link` are for quiet and inline actions.
- **Card**: `rounded-lg` (8px), hairline border, `bg-card`, no shadow.
- **Lists of steps** are hairline-divided rows numbered `01`, `02`, `03` in mono.
- Icons are Phosphor: `fill` for a thing (the GitHub mark), `bold` for an action or direction (arrows, carets, plus).

## Do's and don'ts

- Do keep one idea per band, a heading and a one-line lede on the left, the material on the right.
- Do show the product as it appears on a pull request; the comment specimen is the hero image.
- Don't use a shadow, a gradient or a second accent colour.
- Don't put a label above a heading.
- Don't express state with opacity on text; use the muted token.
