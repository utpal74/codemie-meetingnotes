const { requireRole } = require('../../src/middleware/requireRole');

describe('requireRole middleware', () => {
  function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }

  test('returns 401 when session is not authenticated', () => {
    const req = { session: { authenticated: false } };
    const res = mockRes();
    const next = jest.fn();

    requireRole('ADMIN')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 when authenticated but role does not match', () => {
    const req = { session: { authenticated: true, user: { username: 'x', role: 'RECEPTIONIST' } } };
    const res = mockRes();
    const next = jest.fn();

    requireRole('ADMIN')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'FORBIDDEN' }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next when role matches', () => {
    const req = { session: { authenticated: true, user: { username: 'admin', role: 'ADMIN' } } };
    const res = mockRes();
    const next = jest.fn();

    requireRole('ADMIN')(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
