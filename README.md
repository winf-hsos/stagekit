# stagekit

Slide decks as HTML: one file per deck, drawings as SVG, live demonstrators embedded, and the design in one file. stagekit grew out of the LiFi project at Hochschule Osnabrück and now serves lectures and talks across modules.

Principles:

- **A fixed palette** (eight colours, each with a meaning), **four font sizes**, slide text in lower case, no italics. All of it lives in `theme.css` and nowhere else.
- **Every deck has the same structure:** title slide, agenda, one section slide per part, and a location bar (bar plus part name, optionally coloured per part) on every content slide.
- **Build-up in steps instead of animations:** elements with `data-step="n"` appear one after another but keep their place, so nothing jumps.
- **One statement per slide,** little text; the statement is in the picture, the rest in the speaker notes.

What it adds to a plain HTML page:

- **Drawings are SVG** (`draw.js`): boxes, arrows, wires carrying current, gates, lamps, switches, truth tables, verdicts, formulas. They scale without loss and read their colours from the theme.
- **Demonstrators run on the slide** (`<div class="embed"><iframe …>`), not behind a link.
- **Animations** (`anim.js`): a drawing can run in segments (draw, fade, move along a wire, recolour, count, zoom the camera). Every segment ends in a keyframe that is a build-up step, so the PDF and the contact sheet show each one; → plays the next segment, R replays the slide. See `examples/animations/`.
- **Live polls** (`<section class="slide poll">`): the audience answers on their phones, the slide shows a QR code and the results.
- **Speaker notes** in a second window (key N), kept in sync over a BroadcastChannel; fullscreen with F; print view with P; key M cycles the pointer: normal, laser pointer (a red dot; holding the mouse button draws a trail that fades), hidden (for a presenter with its own laser).
- **Export** as PDF, one PNG per frame and a contact sheet via `tools/export.py` (headless Chrome). The PDF is vector: Chrome prints the print view directly, text stays text and drawings stay SVG. **Exception: embedded demonstrators may not print**; an `<iframe>` can stay empty in the PDF, and such decks need `--pdf-raster`.

## Files

| File | Contents |
|---|---|
| `stagekit.css` | layout and typography; reads every value from the theme |
| `stagekit.js` | runtime: title and agenda, location bar, steps, keyboard, notes window, print view, hash routing, live polls; carries the version (`window.stagekit.version`) |
| `draw.js` | SVG helpers: `svg`, `box`, `label`, `line`, `arrow`, `wire`, `dot`, `gate`, `lamp`, `toggle`, `truthTable`, `verdict`, `formula`, `highlight`, `icon`, … |
| `anim.js` | animations of drawings in segments: timeline, keyframes as build-up steps, `draw.g()` to name parts, `draw.image()` for pictures |
| `themes/default.css` | the design tokens; template for a project's `theme.css` |
| `themes/hsos.toml` | a ready look (Hochschule Osnabrück: light slides, Roboto, logo top right); a project takes it with `preset = "hsos"` in its `style.toml` |
| `template/deck.html` | starting point for a new deck |
| `tools/theme.py` | writes `theme.css` from a `style.toml`; `preset` builds on a look from `themes/`, `logo` puts a picture top right on every slide, `[colors.light]` becomes `:root[data-theme="light"]`, switched on by `?theme=light` |
| `tools/sync.py` | brings a project's copy of the framework up to date and sets the cache buster in its decks; `--check` only reports |
| `tools/export.py` | PDF, PNGs, contact sheet (one image per frame, every build-up step separately), step check (`--steps`: elements that move between steps), font check (`--fonts`: text sizes outside the four steps), text overflow check (`--overflow`), warns when a deck loads an outdated copy |
| `tools/start_script.py` | writes `start-presentation.cmd` next to a deck: double-click starts a local server and opens the deck, on a port derived from the deck's name |
| `tools/figures.py` | renders the drawings named in a deck's `figures.js` as standalone SVG files in a palette of the `theme.css` (`--theme light`), code font embedded; for website figures that match the slides |
| `tools/image.py` | generates images through the OpenAI API (gpt-image-2.5-flare, optionally sunburst) for photo slides; needs `OPENAI_API_KEY` |
| `tools/icon.py` | finds Bootstrap Icons (`--search`) and prints them as `<svg>` for HTML or as paths for `draw.icon()` (`--js`); version pinned, cache in `tools/.icons/` |
| `tools/r/theme_stagekit.R` | ggplot2 theme for figures on stagekit slides |
| `tools/selftest.py` | self-test: syntax, tools, export of `tests/deck/selftest.html` with step and font checks, frames compared with `tests/reference/<platform>/` |
| `tools/release.py` | turns the unreleased part of `CHANGELOG.md` into a version with tag |
| `SKILL.md` | the workflow for agents (German), with `docs/design-rules.md`, `docs/api.md` and `docs/website.md` for reference |
| `CHANGELOG.md` | what changed in which version and what existing decks have to do (German) |
| `CONTRIBUTING.md` | how changes and releases work |

## Third-party content

Symbols that `tools/icon.py` inserts come from [Bootstrap Icons](https://icons.getbootstrap.com), copyright The Bootstrap Authors, licensed under the [MIT License](https://github.com/twbs/icons/blob/main/LICENSE). They are not part of this repository; the tool downloads them on demand and writes their origin as a comment next to each symbol.

`fonts/RobotoMono-Regular.woff2` is Roboto Mono, copyright 2015 The Roboto Mono Project Authors, licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0); see `fonts/NOTICE`. The MIT License of this repository covers stagekit itself, not the font.

## Creating a deck

From the course project, give the tool the directory for the new deck:

```powershell
python C:/code/stagekit/tools/new_deck.py slides/selection-bias
```

This creates `selection-bias.html`, `deck.js`, `theme.css`, speaker notes in the HTML and `skript.md`, and a Windows launcher. Use `--title "Selection bias"` to supply the display title and derive the HTML filename from it. Existing output files are protected.

The tool uses the nearest enclosing `style.toml` and project copy of `stagekit/`. If the runtime is missing, it installs one beside the style file. Without an inherited style it starts a deck-local `style.toml` with English defaults; `--theme hsos` starts it on a look from `themes/` instead. Use `tools/sync.py` when you want to update a shared runtime.

1. Replace the template's sample content and notes. Set the subtitle and parts in the HTML, and edit drawings in `deck.js`.
2. Double-click `start-presentation.cmd`. Press **N** in the deck for the notes window.
3. Export with `python C:/code/stagekit/tools/export.py slides/selection-bias/selection-bias.html` for the PDF, frame images, contact sheet, and checks.

For a local revision, add `--frames 12` to preview every build of the slide containing frame 12. Use `--frames 12-15` for exactly those frames, or `--frames 12-12` for one image. Numbering starts at 1, as in the player and PDF. The command prints the path to a compact contact sheet alongside full-size PNGs in `slides/`. Each run gets a fresh directory under `export-preview/`; with `--out DIR` it uses a sibling named `DIR-preview/`. Both the preview and the default full export check visible text on every selected frame against the slide edges and each `d.box()` label against its own rectangle. Findings give the frame number, text, edge and distance in slide pixels. Use `--overflow` for a check without rendering images. Findings or unreadable frames give a nonzero exit status. Projects with an older copy of `draw.js` get slide-edge checks and a reminder to sync for box coverage. Run the ordinary full export for delivery.

For an animation, `python tools/export.py examples/animations/animations.html --motion 7` produces a strip and three full-size PNGs showing the start, midpoint and end of the segment ending at frame 7. The [animation demo](examples/animations/deck.js) also shows how to reuse an edge-to-edge connection as a packet route with `draw.connect`, and how to retarget a photo annotation and its camera together with `draw.closeup`.

## Keyboard

→ ↓ space PgDn: next (steps first, then slides) · ← ↑ PgUp: back · Home/End · a number and Enter: go to that frame (1 Enter is the start) · F: fullscreen · N: notes window · P: print view · M: pointer mode · R: replay the animation of the slide · click on the right or left fifth of the window: next/back. Inside an input field or a writable box (`contenteditable`) keys and clicks belong to the field.

## Addresses

`deck.html#12` opens frame 12; a build-up step is a frame with its own number. `?slide=12` does the same (for screenshots). `?print` shows all frames one below the other. `?notes` is the notes window. `?bar=1` adds a control bar for decks embedded in a website.

## Development

Run `python tools/selftest.py` before every commit, and see `CONTRIBUTING.md` for changes and releases.
