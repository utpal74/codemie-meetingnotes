'use strict';

/**
 * Dependency-free validator that mirrors request.schema.json.
 * Returns { valid, errors, value } where value is the normalized request.
 */

const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const ISSUE_KEY = /^[A-Z][A-Z0-9_]+-[0-9]+$/;
const ANSWER_KEYS = ['actor', 'goal', 'trigger', 'outcome', 'rule'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function validateRequest(input) {
  const errors = [];
  if (!isObj(input)) return { valid: false, errors: ['request must be a JSON object'] };

  const allowed = ['requestId', 'title', 'requestText', 'source', 'requester', 'links', 'constraints'];
  Object.keys(input).forEach((k) => {
    if (!allowed.includes(k)) errors.push(`unknown field "${k}"`);
  });

  if (typeof input.requestId !== 'string' || !REQUEST_ID.test(input.requestId)) {
    errors.push('requestId is required and must match ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$');
  } else if (input.requestId.includes('..')) {
    errors.push('requestId must not contain ".."');
  }
  if (typeof input.requestText !== 'string' || input.requestText.trim().length < 10) {
    errors.push('requestText is required (min 10 characters)');
  } else if (input.requestText.length > 20000) {
    errors.push('requestText must be at most 20000 characters');
  }
  if (input.title !== undefined && (typeof input.title !== 'string' || input.title.length > 255)) {
    errors.push('title must be a string of at most 255 characters');
  }
  if (input.source !== undefined) {
    if (!isObj(input.source)) errors.push('source must be an object');
    else if (input.source.issueKey !== undefined && !ISSUE_KEY.test(String(input.source.issueKey))) {
      errors.push('source.issueKey must look like ABC-123');
    }
  }
  if (input.requester !== undefined && !isObj(input.requester)) errors.push('requester must be an object');
  if (input.links !== undefined && (!Array.isArray(input.links) || input.links.some((l) => typeof l !== 'string'))) {
    errors.push('links must be an array of strings');
  }
  if (input.constraints !== undefined && !isObj(input.constraints)) errors.push('constraints must be an object');

  if (errors.length) return { valid: false, errors };
  return {
    valid: true,
    errors: [],
    value: { ...input, requestText: input.requestText.trim(), links: input.links || [] },
  };
}

function validateAnswers(input) {
  if (input === undefined || input === null) return { valid: true, errors: [], value: {} };
  if (!isObj(input)) return { valid: false, errors: ['answers must be a JSON object'] };
  const errors = [];
  const value = {};
  Object.keys(input).forEach((k) => {
    if (!ANSWER_KEYS.includes(k)) errors.push(`unknown answer key "${k}" (allowed: ${ANSWER_KEYS.join(', ')})`);
    else if (typeof input[k] !== 'string') errors.push(`answer "${k}" must be a string`);
    else if (input[k].trim()) value[k] = input[k].trim();
  });
  return { valid: errors.length === 0, errors, value };
}

module.exports = { validateRequest, validateAnswers, ANSWER_KEYS };
