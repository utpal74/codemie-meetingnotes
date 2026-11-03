'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Tiny deterministic renderer: replaces {{name}} and drops the
 * "<!-- template: name vN -->" version marker line. Missing vars throw.
 */
function renderTemplate(name, vars) {
  const raw = fs.readFileSync(path.join(__dirname, `${name}.md`), 'utf8').replace(/\r\n/g, '\n');
  return raw
    .replace(/^<!-- template: .* -->\n/, '')
    .replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (!(key in vars)) throw new Error(`Template "${name}" is missing variable "${key}"`);
      return String(vars[key]);
    });
}

module.exports = { renderTemplate };
