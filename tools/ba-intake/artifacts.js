'use strict';

const fs = require('fs');
const path = require('path');

const ARTIFACT_NAMES = {
  intake: '01-intake.json',
  candidates: '02-duplicate-candidates.json',
  candidatesMd: '02-duplicate-candidates.md',
  questions: '03-clarifying-questions.md',
  story: '04-story-draft.md',
  decision: '05-duplicate-decision.md',
  summary: 'run-summary.json',
};

function artifactDir(rootDir, requestId) {
  const base = path.resolve(rootDir, 'artifacts', 'ba');
  const dir = path.resolve(base, requestId);
  if (path.dirname(dir) !== base) {
    throw new Error(`Refusing to write outside ${base}: requestId "${requestId}"`);
  }
  return dir;
}

/** Write { fileName: string|object } under artifacts/ba/<requestId>/. Returns file names written (sorted). */
function writeArtifacts({ rootDir, requestId, files }) {
  const dir = artifactDir(rootDir, requestId);
  fs.mkdirSync(dir, { recursive: true });
  const names = Object.keys(files).sort();
  names.forEach((name) => {
    const content = files[name];
    const text = typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`;
    fs.writeFileSync(path.join(dir, name), text.endsWith('\n') ? text : `${text}\n`, 'utf8');
  });
  return names;
}

module.exports = { writeArtifacts, artifactDir, ARTIFACT_NAMES };
