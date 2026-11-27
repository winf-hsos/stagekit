# -*- coding: utf-8 -*-
"""Review a stagekit deck before anyone sees it: the story told by its sentences,
numbers per slide with warnings, and a brief for a test audience.

    python tools/review.py <deck.html> --audience "first-year students without prior knowledge" --minutes 45
    python tools/review.py <deck.html> --audience "..." --ask        # the test audience is an OpenAI model

Writes into --out (default: review/ beside the deck):

  story.md      the sentence that carries each slide, in order. Read on its own
                it has to tell the talk; a gap or a repetition shows here first.
  metrics.md    words on the slide, build steps, layout and notes per slide,
                the estimated speaking time, and the warnings below.
  audience.md   the brief for a test audience: who they are, what to report,
                and every slide with its text and its notes. It is complete in
                itself, so a helper agent that knows nothing of the deck can
                work from it and sheet.png alone.
  sheet.png     the contact sheet of all frames (export.py), unless --no-sheet.

Warnings: much text on a slide, the same layout many times in a row, a slide
without notes, two slides carrying the same sentence, many new terms on one
slide, and a speaking time far from --minutes.

--ask sends audience.md and sheet.png to an OpenAI model and writes its answer
to audience-report.md. The key comes only from the environment variable
OPENAI_API_KEY, the model from --model, STAGEKIT_REVIEW_MODEL or the default
below. Only the deck's own text, notes and contact sheet are sent; decks hold
no personal data, and this tool must not be pointed at one that does.
"""
import argparse
import base64
import io
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from urllib.parse import unquote, urlencode, urljoin

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import export as ex  # noqa: E402

# Text model the key reached on 19.11.2026 (GET /v1/models); override with --model.
MODEL = os.environ.get("STAGEKIT_REVIEW_MODEL", "gpt-6-luna")
API_URL = "https://api.openai.com/v1/chat/completions"

FRAME_LAYOUTS = {"title", "agenda", "part"}   # slides stagekit generates; no text rules for them
WORDS_WARN, WORDS_HIGH = 40, 60                # words on a content slide (rule: one statement per slide)
SAME_LAYOUT_RUN = 4                            # this many content slides of one layout in a row
NEW_TERMS_WARN = 4                             # new terms on a single slide
CHECKS_MAX = 8                                 # items on a checklist slide
WORDS_PER_MINUTE = 120                         # speaking pace for the notes
LAYOUT_NAMES = {"figure": "Zeichnung", "lines": "Zeilen", "columns": "Spalten", "code": "Code", "photo": "Foto",
                "embed": "Demo", "statement": "Aussage", "poll": "Abfrage", "other": "sonstiges",
                "number": "große Zahl", "quote": "Zitat", "timeline": "Zeitleiste", "fullbleed": "Vollbildfoto",
                "compare": "Vorher/Nachher", "checklist": "Checkliste", "prediction": "Vorhersage",
                "trace": "Ausführungsprotokoll", "readings": "Lesarten", "measurement": "Messung wählen"}
SIGNATURE = {"number", "quote", "timeline", "fullbleed", "compare", "checklist", "prediction", "trace", "readings", "measurement"}   # signature layouts: an accent, never twice in a row


def read_deck(deck):
    """Every slide as the browser built it, through tools/review-check.html."""
    srv, url = ex.deck_server(deck)
    ch = ex.chrome()
    try:
        address = urljoin(url, ex.REVIEW_PATH) + "?" + urlencode({"deck": url})
        for _ in range(2):
            res = subprocess.run([ch, "--headless=new", "--disable-gpu", "--virtual-time-budget=15000",
                                  "--window-size=1920,1080", "--dump-dom", address],
                                 capture_output=True, text=True, encoding="utf-8", errors="replace")
            m = re.search(r"<title>REVIEW:([^<]+)</title>", res.stdout)
            if m:
                return json.loads(unquote(m[1]))
    finally:
        srv.shutdown()
        srv.server_close()
    raise SystemExit("Das Deck ließ sich nicht auslesen (Prüfseite ohne Ergebnis).")


def frame_numbers(slides):
    """First and last frame of each slide, as the counter and the export number them."""
    first, spans = 1, []
    for s in slides:
        spans.append((first, first + s["frames"] - 1))
        first += s["frames"]
    return spans


def label(s, span):
    frames = f"{span[0]}" if span[0] == span[1] else f"{span[0]}–{span[1]}"
    return f"Folie {s['slide']} (Frame {frames})"


def warnings(data, minutes):
    slides, spans, out = data["slides"], frame_numbers(data["slides"]), []
    content = [s for s in slides if s["layout"] not in FRAME_LAYOUTS]
    for s in content:
        tag = label(s, spans[s["slide"] - 1])
        # a drawing counts the labels of every animation segment at once, so
        # its number says little; the overflow check covers crowded drawings
        if s["layout"] == "figure":
            pass
        elif s["words"] > WORDS_HIGH:
            out.append(f"{tag}: {s['words']} Wörter auf der Folie, deutlich zu viel für eine Aussage")
        elif s["words"] > WORDS_WARN:
            out.append(f"{tag}: {s['words']} Wörter auf der Folie, eher zu viel")
        if not s["noteWords"]:
            out.append(f"{tag}: keine Notizen; was hier gesagt wird, steht nirgends")
        if s["layout"] in ("number", "quote") and not s.get("source", True):
            what = "Zahl" if s["layout"] == "number" else "Zitat"
            out.append(f"{tag}: {what} ohne Quelle (Fußnote bzw. .quote-by)")
        if s["layout"] == "compare" and s.get("labels", 2) < 2:
            out.append(f"{tag}: Vorher/Nachher ohne Beschriftung beider Seiten (data-label)")
        if s["layout"] == "checklist" and s.get("checks", 0) > CHECKS_MAX:
            out.append(f"{tag}: {s['checks']} Punkte in der Checkliste, höchstens {CHECKS_MAX} passen lesbar auf eine Folie")
    # the same layout again and again
    run = []
    for s in content + [None]:
        if s and run and s["layout"] == run[-1]["layout"] and s["slide"] == run[-1]["slide"] + 1:
            run.append(s)
            continue
        if len(run) >= SAME_LAYOUT_RUN and run[0]["layout"] != "figure":
            out.append(f"Folien {run[0]['slide']}–{run[-1]['slide']}: {len(run)}-mal hintereinander "
                       f"Layout „{run[0]['layout']}“")
        run = [s] if s else []
    # a signature layout twice in a row wears off
    for a, b in zip(content, content[1:]):
        if a["layout"] in SIGNATURE and a["layout"] == b["layout"] and b["slide"] == a["slide"] + 1:
            out.append(f"Folien {a['slide']} und {b['slide']}: zweimal hintereinander „{LAYOUT_NAMES[a['layout']]}“; "
                       "ein Signature-Layout wirkt nur als Ausnahme")
    # the same carrying sentence twice
    seen = {}
    for s in content:
        key = s["lead"].lower()
        if len(key) > 12:
            if key in seen:
                out.append(f"Folien {seen[key]} und {s['slide']}: derselbe tragende Satz „{s['lead']}“")
            else:
                seen[key] = s["slide"]
    # many new terms at once
    known = set()
    for s in slides:
        new = [t for t in s["terms"] if t.lower() not in known]
        known |= {t.lower() for t in s["terms"]}
        s["newTerms"] = new
        if len(new) > NEW_TERMS_WARN and s["layout"] not in FRAME_LAYOUTS:
            out.append(f"{label(s, spans[s['slide'] - 1])}: {len(new)} neue Begriffe auf einmal ({', '.join(new)})")
    spoken = sum(s["noteWords"] for s in slides) / WORDS_PER_MINUTE
    if minutes:
        if spoken > minutes * 1.1:
            out.append(f"Sprechzeit nach den Notizen rund {spoken:.0f} min, geplant sind {minutes} min")
        elif spoken < minutes * 0.5:
            out.append(f"Sprechzeit nach den Notizen nur rund {spoken:.0f} min von {minutes} min; "
                       "Notizen dünn oder Platz für Übungen und Fragen eingeplant?")
    return out, spoken


def story(data):
    spans = frame_numbers(data["slides"])
    lines = [f"# Die Geschichte in Sätzen: {data['title']}", "",
             "Je Folie der Satz, der sie trägt. Liest sich diese Liste nicht als Geschichte, "
             "fehlt eine Folie, eine ist überflüssig oder ein Satz sagt nicht, worum es geht.", ""]
    part = None
    for s, span in zip(data["slides"], spans):
        if s["part"] != part and s["part"]:
            part = s["part"]
            lines += ["", f"## {part}", ""]
        if s["layout"] in ("title", "agenda"):
            continue
        sentence = s["lead"] or f"{s['heading'] or '(ohne Überschrift)'} ({LAYOUT_NAMES.get(s['layout'], s['layout'])})"
        lines.append(f"{span[0]:>3}. {sentence}")
    return "\n".join(lines) + "\n"


def metrics(data, found, spoken, minutes):
    spans = frame_numbers(data["slides"])
    lines = [f"# Kennzahlen: {data['title']}", "",
             f"{len(data['slides'])} Folien, {spans[-1][1]} Frames, Sprechzeit nach den Notizen rund "
             f"{spoken:.0f} min ({WORDS_PER_MINUTE} Wörter je Minute)" + (f", geplant {minutes} min" if minutes else "") + ".", "",
             "## Warnungen", ""]
    lines += [f"- {w}" for w in found] or ["- keine"]
    lines += ["", "## Je Folie", "", "| Folie | Frames | Layout | Wörter | Notizen | neue Begriffe | Überschrift |",
              "|---:|---|---|---:|---:|---|---|"]
    for s, span in zip(data["slides"], spans):
        frames = f"{span[0]}" if span[0] == span[1] else f"{span[0]}–{span[1]}"
        lines.append(f"| {s['slide']} | {frames} | {s['layout']} | {s['words']} | {s['noteWords']} | "
                     f"{', '.join(s.get('newTerms', []))} | {s['heading']} |")
    return "\n".join(lines) + "\n"


def brief(data, audience, minutes, sheet):
    who = audience or "eine Person aus der Zielgruppe dieses Vortrags"
    spans = frame_numbers(data["slides"])
    lines = [
        f"# Probepublikum: {data['title']}", "",
        f"Du bist **{who}**. Du sitzt in diesem Vortrag"
        + (f", der rund {minutes} Minuten dauert" if minutes else "")
        + ", und weißt über das Thema nur, was für diese Gruppe typisch ist. Unten stehen die Folien in ihrer "
          "Reihenfolge, jeweils mit dem, was darauf steht, und dem, was die vortragende Person dazu sagt."
        + (" Der Kontaktbogen `sheet.png` daneben zeigt jede Folie und jeden Aufbauschritt als Bild, "
           "nummeriert nach Frames." if sheet else ""), "",
        "Geh den Vortrag einmal von vorn bis hinten so durch, wie du ihn im Raum erleben würdest. Antworte dann "
        "knapp unter diesen Überschriften und nenne jeweils die Foliennummer:", "",
        "## Wo ich den Faden verliere", "## Begriffe, die mir niemand erklärt", "## Folien, die dasselbe sagen",
        "## Was ich streichen würde", "## Was ich nach dem Vortrag mitnehme", "",
        "Unter der letzten Überschrift stehen höchstens drei Sätze in deinen eigenen Worten: das, was du einer "
        "Kommilitonin erzählen würdest, die nicht da war. Nenne nur, was dir als diese Person wirklich passieren "
        "würde, und erfinde nichts, damit eine Liste voll wird; bleibt eine Überschrift leer, schreib „nichts“. "
        "Bewerte nicht die Gestaltung, sondern ob du folgen kannst.", "", "---", ""]
    for s, span in zip(data["slides"], spans):
        if s["layout"] == "agenda":
            continue
        lines.append(f"### {label(s, span)}" + (f" · Teil: {s['part']}" if s["part"] else ""))
        if s["heading"]:
            lines.append(f"Überschrift: {s['heading']}")
        lines.append(f"Auf der Folie: {s['text'] or '(nur Bild)'}")
        if s["notes"]:
            lines.append(f"Gesagt: {s['notes']}")
        lines.append("")
    return "\n".join(lines)


def make_sheet(deck, out):
    # a sheet younger than every file of the deck's folder is still right
    sheet = out / "sheet.png"
    newest = max((p.stat().st_mtime for p in deck.parent.iterdir() if p.is_file()), default=0)
    if sheet.exists() and sheet.stat().st_mtime > newest:
        return sheet
    # only the sheet is kept: the frames would add megabytes to a synced deck folder
    with tempfile.TemporaryDirectory(prefix="stagekit-review-") as frames:
        subprocess.run([sys.executable, str(pathlib.Path(__file__).with_name("export.py")), str(deck),
                        "--png", "--sheet", "--out", frames], capture_output=True)
        made = pathlib.Path(frames) / "sheet.png"
        if made.exists():
            shutil.copy(made, sheet)
            return sheet
    print("  hinweis: kein Kontaktbogen entstanden; der Auftrag kommt ohne Bild aus")
    return None


def ask(text, sheet, model):
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        raise SystemExit("OPENAI_API_KEY ist nicht gesetzt; ohne Schlüssel kein Probepublikum über die API. "
                         "audience.md steht trotzdem bereit, etwa für einen Hilfsagenten.")
    content = [{"type": "text", "text": text}]
    if sheet:
        from PIL import Image
        im = Image.open(sheet).convert("RGB")
        im.thumbnail((2048, 2048))
        buf = io.BytesIO()
        im.save(buf, "PNG")
        content.append({"type": "image_url", "image_url": {
            "url": "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode(), "detail": "high"}})
    payload = {"model": model, "messages": [
        {"role": "system", "content": "Du spielst ein Probepublikum für einen Vortrag. Du antwortest auf Deutsch, "
                                      "ehrlich und knapp, in ganzen Sätzen, aus der Sicht der beschriebenen Person."},
        {"role": "user", "content": content}]}
    req = urllib.request.Request(API_URL, data=json.dumps(payload).encode("utf-8"),
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            answer = json.load(r)
    except urllib.error.HTTPError as error:
        raise SystemExit(f"OpenAI meldet {error.code}:\n{error.read().decode('utf-8', 'replace')}")
    return answer["choices"][0]["message"]["content"]


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("deck")
    ap.add_argument("--audience", default="", help="who listens, e.g. \"first-year students without prior knowledge\"")
    ap.add_argument("--minutes", type=int, default=0, help="planned length of the talk")
    ap.add_argument("--ask", action="store_true", help="let an OpenAI model act as the test audience")
    ap.add_argument("--model", default=MODEL)
    ap.add_argument("--out", default=None)
    ap.add_argument("--no-sheet", action="store_true", dest="no_sheet")
    a = ap.parse_args()
    if a.ask and not a.audience:
        ap.error("--ask needs --audience: the model has to know who it is")
    deck = pathlib.Path(a.deck).resolve()
    out = pathlib.Path(a.out).resolve() if a.out else deck.parent / "review"
    out.mkdir(parents=True, exist_ok=True)

    data = read_deck(deck)
    found, spoken = warnings(data, a.minutes)
    (out / "story.md").write_text(story(data), encoding="utf-8")
    (out / "metrics.md").write_text(metrics(data, found, spoken, a.minutes), encoding="utf-8")
    sheet = None if a.no_sheet else make_sheet(deck, out)
    text = brief(data, a.audience, a.minutes, sheet)
    (out / "audience.md").write_text(text, encoding="utf-8")

    print(f"{len(data['slides'])} Folien, Sprechzeit nach den Notizen rund {spoken:.0f} min")
    print(f"story: {out / 'story.md'}")
    print(f"metrics: {out / 'metrics.md'} ({len(found)} Warnungen)")
    for w in found:
        print(f"  {w}")
    print(f"audience: {out / 'audience.md'}" + (f" (+ {sheet.name})" if sheet else ""))
    if a.ask:
        report = ask(text, sheet, a.model)
        (out / "audience-report.md").write_text(f"# Probepublikum ({a.audience}, {a.model})\n\n{report}\n", encoding="utf-8")
        print(f"audience-report: {out / 'audience-report.md'}")
        print(report)
    return 0


if __name__ == "__main__":
    sys.exit(main())
