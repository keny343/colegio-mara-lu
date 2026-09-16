const { fileFilter } = require('../src/config/uploadFilters');

function runFilter(file) {
  return new Promise((resolve) => {
    fileFilter({}, file, (err, ok) => resolve({ err, ok }));
  });
}

describe('upload fileFilter', () => {
  test('allows pdf with matching mime', async () => {
    const { err, ok } = await runFilter({
      originalname: 'boletim.pdf',
      mimetype: 'application/pdf',
    });
    expect(err).toBeNull();
    expect(ok).toBe(true);
  });

  test('rejects executable', async () => {
    const { err, ok } = await runFilter({
      originalname: 'malware.exe',
      mimetype: 'application/octet-stream',
    });
    expect(ok).toBeUndefined();
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(400);
  });

  test('rejects mime/extension mismatch', async () => {
    const { err } = await runFilter({
      originalname: 'foto.exe',
      mimetype: 'image/jpeg',
    });
    expect(err).toBeInstanceOf(Error);
  });
});
