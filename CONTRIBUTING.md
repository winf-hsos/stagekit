# Contributing to stagekit

stagekit is the slide framework of Prof. Dr. Nicolas Meseth at Hochschule
Osnabrück. It is used by many projects at once, most of them maintained by
AI agents, so changes follow a fixed path.

## Asking for a change

- **Inside the Hochschule folder:** do not edit or commit in this repository.
  Report the wish or the bug in your own `STATUS.md` under "Für die zentrale
  Stelle relevant", or ask the session `stagekit` directly. The central
  agent turns it into a task for the stagekit maintainer. Until the change
  arrives, solve it inside your deck, never in your project's copy of the
  framework: `tools/sync.py` overwrites that copy on its next run.
- **Anyone else:** open an issue on GitHub.

## Making a change (maintainer)

1. Change the code, the tools, the template or the rules (`SKILL.md`, `docs/`).
2. Add an entry under "Unveröffentlicht" in `CHANGELOG.md`, in the same
   commit: what changed and what existing decks have to do, if anything.
3. Run `python tools/selftest.py`. When a change is meant to alter how slides
   look, check the reported frames and accept them with `--update` in the
   same commit.
4. Commit only your own lines (never `git commit -a`); the message is English.
5. Stay backward compatible. A change that alters existing decks needs
   Nicolas' approval and a new major version.

## Releasing

Releases bundle several changes. `python tools/release.py patch|minor|major`
turns the "Unveröffentlicht" section into a version: it sets `VERSION` in
`stagekit.js`, renames the section, commits and tags. Nothing is pushed:
every push publishes at once, so it happens only on Nicolas' word,

    git push origin main vX.Y.Z

after which GitHub turns the tag into a release with the same notes. The
self-test runs on GitHub with every push as well.

## Updating a project

    python <stagekit>/tools/sync.py <project folder> --check   # what is behind?
    python <stagekit>/tools/sync.py <project folder>           # update copy and decks

## Language

Code, comments, commit messages, `README.md` and this file are English.
`SKILL.md`, `docs/` and `CHANGELOG.md` stay German: they are rules for the
decks of a German-speaking author, not code documentation.
