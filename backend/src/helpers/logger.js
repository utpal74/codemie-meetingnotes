const pino = require('pino');
const { sanitize } = require('./sanitize');

const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
  serializers: {
    req(req) {
      return sanitize({
        method: req.method,
        url: req.url,
        query: req.query,
      });
    },
    err: pino.stdSerializers.err,
  },
});

module.exports = logger;
