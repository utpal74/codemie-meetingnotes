'use strict';

const { renderTemplate } = require('../templates/render');

const MAX_QUESTIONS = 5;

const DETAILS = [
  { key: 'actor', topic: 'Users & roles', text: 'Who is the primary user or role that needs this capability?' },
  { key: 'goal', topic: 'Desired behavior', text: 'What exactly should that user be able to achieve?' },
  { key: 'trigger', topic: 'Desired behavior', text: 'What event or action starts this flow?' },
  { key: 'outcome', topic: 'Success outcome', text: 'What observable result defines success?' },
  { key: 'rule', topic: 'Business rules', text: 'What key business rule, constraint, or limit applies?' },
];

const PATTERNS = {
  actor: [
    /\bas (?:an?|the) ([^,.;\n]{2,60})/i,
    /\b(receptionist|administrator|admin|business analyst|engineer|developer|customer|patient|doctor|manager|requester|user)s?\b/i,
  ],
  goal: [/\b(?:i want(?: to)?|want to|wants to|needs? to|should be able to|must be able to|would like to|to be able to) ([^,.;\n]{3,120})/i],
  trigger: [/\b((?:when|whenever|after|before|once|upon|if) [^,.;\n]{3,100})/i],
  outcome: [/\b(?:so that|then|results? in|should result in|expected|in order to|success(?:ful)? when) ([^,.;\n]{3,120})/i],
  rule: [/\b((?:must not|must|only|never|at most|at least|no more than|cannot|should not|limited to|maximum|minimum|within \d+)\b[^,.;\n]{2,100})/i],
};

/** Extract a snippet for each required detail, or null when absent. */
function detectDetails(requestText) {
  const out = {};
  DETAILS.forEach(({ key }) => {
    out[key] = null;
    for (const re of PATTERNS[key]) {
      const m = requestText.match(re);
      if (m) {
        out[key] = (m[1] || m[0]).trim();
        break;
      }
    }
  });
  return out;
}

function generateQuestions({ requestText, answers = {} }) {
  const detected = detectDetails(requestText);
  const missing = DETAILS.filter(({ key }) => !detected[key] && !answers[key]);
  const questions = missing.slice(0, MAX_QUESTIONS).map((d) => ({ key: d.key, topic: d.topic, text: d.text }));
  return {
    questions,
    details: Object.fromEntries(DETAILS.map(({ key }) => [key, answers[key] || detected[key] || null])),
    state: questions.length ? 'NEEDS_INPUT' : 'READY',
  };
}

/** Questions used instead when the BA flagged the request as a duplicate. */
function duplicateConfirmationQuestions(duplicateOf) {
  return [
    { key: 'duplicate', topic: 'Duplicate confirmation', text: `Please confirm this request duplicates ${duplicateOf}.` },
    { key: 'source', topic: 'Duplicate confirmation', text: 'What should happen to the source request (link only, comment, or leave open)?' },
  ];
}

function formatQuestionsMarkdown({ requestId, state, questions }) {
  let body;
  if (!questions.length) {
    body = '_No clarifying questions: all required details are present._';
  } else {
    const lines = [];
    let lastTopic = null;
    questions.forEach((q, i) => {
      if (q.topic !== lastTopic) {
        if (lastTopic !== null) lines.push('');
        lines.push(`## ${q.topic}`);
        lastTopic = q.topic;
      }
      lines.push(`${i + 1}. ${q.text}`);
    });
    body = lines.join('\n');
  }
  return renderTemplate('clarifying_questions', { requestId, state, body });
}

module.exports = { generateQuestions, detectDetails, duplicateConfirmationQuestions, formatQuestionsMarkdown, MAX_QUESTIONS, DETAILS };
