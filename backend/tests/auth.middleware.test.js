jest.mock('../src/config/database', () => ({
  query: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const db = require('../src/config/database');
const { authMiddleware, adminMiddleware } = require('../src/middleware/auth');

const SECRET = 'test-jwt-secret-for-unit-tests';

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('authMiddleware', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    db.query.mockReset();
  });

  test('returns 401 when token missing', async () => {
    const req = { cookies: {}, headers: {} };
    const res = mockRes();
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 for inactive account', async () => {
    const token = jwt.sign({ id: 7, v: 1, nome: 'Ana' }, SECRET);
    db.query.mockResolvedValue([[{
      id: 7, role: 'admin', curso_coordenado: null, nivel_coordenado: null, token_version: 1, ativo: 0,
    }]]);
    const req = { cookies: { token }, headers: {} };
    const res = mockRes();
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/desactivada/i) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when token_version mismatches', async () => {
    const token = jwt.sign({ id: 3, v: 1 }, SECRET);
    db.query.mockResolvedValue([[{
      id: 3, role: 'professor', curso_coordenado: null, nivel_coordenado: null, token_version: 2, ativo: 1,
    }]]);
    const req = { cookies: {}, headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/Faça login novamente/i) })
    );
  });

  test('loads fresh role from DB and calls next', async () => {
    const token = jwt.sign({ id: 1, v: 1, nome: 'Admin' }, SECRET);
    db.query.mockResolvedValue([[{
      id: 1,
      role: 'admin',
      curso_coordenado: null,
      nivel_coordenado: null,
      token_version: 1,
      ativo: 1,
    }]]);
    const req = { cookies: { token }, headers: {} };
    const res = mockRes();
    const next = jest.fn();
    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({ id: 1, role: 'admin' });
  });

  test('adminMiddleware rejects non-admin after auth', async () => {
    const token = jwt.sign({ id: 9, v: 1 }, SECRET);
    db.query.mockResolvedValue([[{
      id: 9, role: 'professor', curso_coordenado: null, nivel_coordenado: null, token_version: 1, ativo: 1,
    }]]);
    const req = { cookies: { token }, headers: {} };
    const res = mockRes();
    const next = jest.fn();

    await new Promise((resolve) => {
      res.status.mockImplementation((code) => {
        res.statusCode = code;
        queueMicrotask(resolve);
        return res;
      });
      adminMiddleware(req, res, () => {
        next();
        resolve();
      });
    });

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
