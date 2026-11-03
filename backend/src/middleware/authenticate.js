const { Errors } = require('../helpers/errors');

function authenticate(req, res, next) {
  if (!req.session || !req.session.authenticated) {
    const err = Errors.UNAUTHORIZED();
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, field: null },
    });
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session || !req.session.authenticated) {
      const err = Errors.UNAUTHORIZED();
      return res.status(err.status).json({
        error: { code: err.code, message: err.message, field: null },
      });
    }
    if (req.session.role !== role) {
      const err = Errors.FORBIDDEN();
      return res.status(err.status).json({
        error: { code: err.code, message: err.message, field: null },
      });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
