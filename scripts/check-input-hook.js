#!/usr/bin/env node
/**
 * UserPromptSubmit hook — checks docs/input/ for unprocessed user story files.
 * Fires when: at least one .docx/.txt/.md input file exists AND it is newer than
 * artifacts/requirements.md (or requirements.md does not yet exist).
 * README.md (any casing), hidden files, and Word lock files (~$*) are never treated as input.
 *
 * Outputs plain text that Claude Code injects as system context.
 */

const fs = require('fs');
const path = require('path');

const INPUT_DIR = path.join(process.cwd(), 'docs', 'input');
const REQ_FILE  = path.join(process.cwd(), 'artifacts', 'requirements.md');

function isUserStoryFile(name) {
  if (name.startsWith('.') || name.startsWith('~$')) return false;
  if (name.toLowerCase() === 'readme.md') return false;
  return /\.(docx|txt|md)$/i.test(name);
}

function getInputFiles() {
  try {
    return fs.readdirSync(INPUT_DIR)
      .filter(isUserStoryFile)
      .filter(f => fs.statSync(path.join(INPUT_DIR, f)).isFile())
      .map(f => ({ name: f, mtime: fs.statSync(path.join(INPUT_DIR, f)).mtimeMs }));
  } catch {
    return [];
  }
}

function getReqMtime() {
  try { return fs.statSync(REQ_FILE).mtimeMs; }
  catch { return 0; }
}

const inputFiles = getInputFiles();
if (inputFiles.length === 0) process.exit(0);

const reqMtime = getReqMtime();
// Trigger only if ANY input file is newer than the requirements doc
const unprocessed = inputFiles.filter(f => f.mtime > reqMtime);

if (unprocessed.length > 0) {
  const fileList = unprocessed.map(f => f.name).join(', ');
  process.stdout.write([
    '---',
    `[SDLC AUTO-TRIGGER] Unprocessed user story file(s) detected in docs/input/: ${fileList}`,
    'Unless the user has given a different instruction, invoke the sdlc-orchestrator agent',
    'immediately to run the full 8-step SDLC pipeline on this file.',
    '---',
  ].join('\n') + '\n');
}

process.exit(0);
