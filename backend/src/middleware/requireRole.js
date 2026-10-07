const { Errors } = require('../helpers/errors');

/**
 * Middleware factory that checks the session user has the required role.
 * Must be used AFTER the `authenticate` middleware (which verifies the session exists).
 *
 * @param {string} role - Required role, e.g. 'ADMIN' or 'RECEPTIONIST'
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.session || !req.session.authenticated) {
      const err = Errors.UNAUTHORIZED();
      return res.status(err.status).json({
        error: { code: err.code, message: err.message, field: null },
      });
    }
    if (req.session.user?.role !== role) {
      const err = Errors.FORBIDDEN();
      return res.status(err.status).json({
        error: { code: err.code, message: err.message, field: null },
      });
    }
    next();
  };
}

module.exports = { requireRole };
