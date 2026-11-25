"""Create a playable Stagekit starter in a course project."""
import argparse
from html import escape
from pathlib import Path
import re
import shutil
from tempfile import TemporaryDirectory
from textwrap import dedent
import tomllib
import unicodedata

from stagekit_version import REPO, RUNTIME, cache_tag
from start_script import launcher
from theme import render


def deck_slug(title):
    text = title.lower().translate(str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"}))
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_text)[:50].strip("-") or "deck"


def prepare_runtime(folder):
    """Install a complete new copy as a unit, or reuse the project's copy."""
    if not folder.exists():
        folder.parent.mkdir(parents=True, exist_ok=True)
        with TemporaryDirectory(dir=folder.parent, prefix=".stagekit-") as tmp:
            staged = Path(tmp) / "runtime"
            for name in RUNTIME:
                (staged / name).parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(REPO / name, staged / name)
            try:
                staged.rename(folder)
            except OSError:
                if not folder.is_dir():
                    raise
                # Another deck may have installed the shared runtime first.
    for name in ("stagekit.js", "stagekit.css", "draw.js"):
        if not (folder / name).is_file():
            raise ValueError(f"Incomplete framework in {folder}. Check the project copy with tools/sync.py.")


def create_deck(folder, title, theme=None):
    folder = folder.resolve()
    ancestors = (folder, *folder.parents)
    style = next((p / "style.toml" for p in ancestors if (p / "style.toml").is_file()), None)
    runtime = next((p / "stagekit" for p in ancestors
                    if (p / "stagekit" / "stagekit.js").is_file() and (p / "stagekit").resolve() != REPO),
                   (style.parent if style else folder) / "stagekit")
    if folder.is_relative_to(runtime) or folder == REPO or runtime.resolve() == REPO:
        raise ValueError("Choose a deck directory outside the framework itself.")

    default_style = '[stagekit]\nlanguage = "en"\n' + (f'preset = "{theme}"\n' if theme else "")
    if theme and style:
        raise ValueError(f'{style} already sets the look of this project; add preset = "{theme}" '
                         "under [stagekit] there instead of --theme.")
    config = tomllib.loads(style.read_text(encoding="utf-8-sig") if style else default_style)
    language = config.get("stagekit", {}).get("language", "en")
    title = title or folder.name.replace("-", " ")
    deck = folder / (deck_slug(title) + ".html")
    template = (REPO / "template/deck.html").read_text(encoding="utf-8")
    before, inline, after = re.split(r"<script>\s*\n(.*?)</script>", template, flags=re.S)
    notes = re.findall(r'<aside class="notes">(.*?)</aside>', template, flags=re.S)
    files = {
        "deck.js": (dedent(inline).strip() + "\n").encode("utf-8"),
        "theme.css": render(config, style.parent if style else folder).encode("utf-8"),
        "skript.md": ("\n\n".join([f"# {title}", *notes]) + "\n").encode("utf-8"),
    }
    if not style:
        files["style.toml"] = default_style.encode("utf-8")
    for name in (*files, deck.name, "start-presentation.cmd"):
        if (folder / name).exists():
            raise ValueError(f"{folder / name} already exists. Choose a new deck directory.")
    html = before + '<script src="deck.js"></script>' + after
    html = html.replace('href="../theme.css"', 'href="theme.css"')
    html = html.replace('<html lang="en">', f'<html lang="{escape(language, quote=True)}">')
    html = html.replace('<title>deck title</title>', f'<title>{escape(title)}</title>')
    # Stagekit uses the decoded data-title as markup when it builds the title slide.
    html = html.replace('data-title="deck title"', f'data-title="{escape(escape(title))}"')
    html = html.replace('data-subtitle="occasion · date"', 'data-subtitle=""')
    html = html.replace('  <!-- stagekit: adjust the two paths to where the repository lives relative to this file -->\n', '')

    prepare_runtime(runtime)
    prefix = "../" * len(folder.relative_to(runtime.parent).parts) + "stagekit/"
    tag = cache_tag(runtime)
    html = re.sub(r'\.\./\.\./stagekit/([\w.-]+)', lambda m: f"{prefix}{m[1]}?v={tag}", html)
    files[deck.name] = html.encode("utf-8")
    files["start-presentation.cmd"], _, _ = launcher(deck, html)

    folder.mkdir(parents=True, exist_ok=True)
    created = []
    try:
        for name, data in files.items():
            path = folder / name
            with path.open("xb") as stream:
                created.append(path)
                stream.write(data)
    except OSError:
        for path in reversed(created):
            path.unlink(missing_ok=True)
        raise
    return deck


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path, help="destination deck directory")
    parser.add_argument("--title", help="deck title (defaults to the directory name with spaces)")
    parser.add_argument("--theme", help="a look from themes/ for a project without a style.toml, e.g. hsos")
    args = parser.parse_args()
    try:
        deck = create_deck(args.folder, args.title, args.theme)
    except (ValueError, OSError) as error:
        parser.exit(1, f"new_deck: {error}\n")
    print(f"Deck: {deck}\nLauncher: {deck.parent / 'start-presentation.cmd'}")


if __name__ == "__main__":
    main()
