function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const first = result.error.errors[0];
      return res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: first.message,
          field: first.path[0] || null,
        },
      });
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validate };
