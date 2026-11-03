'use strict';

const STOPWORDS = new Set((
  'a an and are as at be been but by can could do does for from has have how i if in into is it its ' +
  'may must of on or our should so that the their then there these they this to us was we were what ' +
  'when where which who will with would you your want need needs able also not no than more most ' +
  'user users feature request requests enhancement add new'
).split(' '));

/** Heuristic key-term extraction: frequency-ranked, first-seen tie break. */
function extractKeyTerms({ requestText, title, maxTerms = 5 }) {
  const text = `${title || ''} ${requestText}`.toLowerCase();
  const words = text.match(/[a-z][a-z0-9]{2,}/g) || [];
  const stats = new Map();
  words.forEach((w, idx) => {
    if (STOPWORDS.has(w)) return;
    const s = stats.get(w) || { count: 0, first: idx };
    s.count += 1;
    stats.set(w, s);
  });
  const terms = [...stats.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[1].first - b[1].first)
    .slice(0, maxTerms)
    .map(([w]) => w);
  const firstSentence = requestText.split(/(?<=[.!?])\s|\n/)[0].trim();
  const proposedSummary = (title && title.trim()) || firstSentence.slice(0, 120);
  return { terms, proposedSummary };
}

module.exports = { extractKeyTerms, STOPWORDS };
