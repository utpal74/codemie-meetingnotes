# docs/input — User Story Drop Zone

Place your user story document here before starting the SDLC pipeline.

## Supported formats

| Format | Notes |
|---|---|
| `.docx` | Word document — text is extracted automatically via Python/PowerShell |
| `.txt` | Plain text |
| `.md` | Markdown |

## How it works

1. Drop your file here (e.g. `user-story.txt`).
2. The next time you type anything in Claude Code, the `scripts/check-input-hook.js` hook detects the file and automatically triggers the `sdlc-orchestrator` agent. It fires only when the file is newer than `artifacts/requirements.md` (or that file does not exist).
3. The orchestrator runs all 8 SDLC steps unattended, writes every generated document to the root `artifacts/` folder, and opens a PR when complete.

This `README.md` is never treated as a user story (in any casing: `README.md`, `Readme.md`, `readme.md`), nor are hidden files such as `.gitkeep` or Word lock files (`~$*.docx`).

## Manual trigger

If the auto-trigger does not fire, say:

> "Run the sdlc-orchestrator agent"

or invoke it directly as a subagent type named `sdlc-orchestrator`.

## One file at a time

The pipeline processes one user story per run. Archive or delete the processed file before dropping a new one.
