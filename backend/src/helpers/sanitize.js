function maskPhone(phone) {
  if (typeof phone !== 'string' || phone.length < 4) return '****';
  return phone.slice(0, 2) + '****' + phone.slice(-2);
}

function sanitize(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const lk = key.toLowerCase();
    if (lk.includes('phone') || lk.includes('mobile')) {
      result[key] = typeof value === 'string' ? maskPhone(value) : value;
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitize(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

module.exports = { sanitize, maskPhone };
