# Word Story Intake

Place the `.docx` file itself in this folder, for example `docs/input/story.docx`; do not create another folder around it. Alternatively, supply its full path when starting the SDLC Orchestrator. The orchestrator extracts the document text with `scripts/extract-word-requirements.ps1` and stops if the source is missing, ambiguous, or unreadable.

The source Word document is the input. `docs/requirements.md` is the reviewed requirements artifact produced from it; the orchestrator does not use an older Markdown artifact as a replacement for a missing Word source.

## Run Locally

1. Open the repository folder in VS Code and start a Copilot Chat session with the `SDLC Orchestrator` agent.
2. Ask it to run the pipeline for `docs/input/story.docx`. Add `local-only` to the request to avoid all commits, pushes, and remote PR creation; the PR author will save a draft to `docs/pr-description.md`.
3. Answer clarification and approval questions as they arise. The agents write artifacts into the local working tree. Backend/frontend checks require Node.js and installed project dependencies.
4. GitHub Actions run only after a push or pull request. Local Git hooks are optional and require the one-time setup documented in `.github/hooks/README.md`.