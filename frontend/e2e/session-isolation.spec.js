// @ts-check

const { test, expect } = require('@playwright/test');

const USER_A = {
  email: process.env.E2E_USER_A_EMAIL,
  senha: process.env.E2E_USER_A_PASSWORD,
};

const USER_B = {
  email: process.env.E2E_USER_B_EMAIL,
  senha: process.env.E2E_USER_B_PASSWORD,
};

let stateA;
let stateB;

test.beforeAll(() => {
  if (
    !USER_A.email ||
    !USER_A.senha ||
    !USER_B.email ||
    !USER_B.senha
  ) {
    throw new Error(
      'Definir E2E_USER_A_EMAIL/PASSWORD e E2E_USER_B_EMAIL/PASSWORD.'
    );
  }
});

async function login(page, user) {
  await page.goto('/login', {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });

  const campoEmail = page.locator('#login-email');
  const campoSenha = page.locator('#login-senha');

  const botaoEntrar = page.getByRole('button', {
    name: /^entrar$/i,
  });

  await expect(campoEmail).toBeVisible({
    timeout: 20_000,
  });

  await expect(campoSenha).toBeVisible({
    timeout: 20_000,
  });

  await expect(botaoEntrar).toBeVisible({
    timeout: 20_000,
  });

  await campoEmail.fill(user.email);
  await campoSenha.fill(user.senha);

  await expect(botaoEntrar).toBeEnabled({
    timeout: 10_000,
  });

  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/auth/login') &&
      response.request().method() === 'POST',
    {
      timeout: 30_000,
    }
  );

  await botaoEntrar.click();

  const loginResponse = await loginResponsePromise;

  if (!loginResponse.ok()) {
    let body = '';

    try {
      body = await loginResponse.text();
    } catch {
      body = '';
    }

    throw new Error(
      `Login rejeitado pelo backend.\n` +
        `HTTP: ${loginResponse.status()}\n` +
        `URL: ${loginResponse.url()}\n` +
        `Resposta: ${body}`
    );
  }

  await expect(page).not.toHaveURL(/\/login/, {
    timeout: 20_000,
  });
}

async function identidadeDaSessao(page) {
  const response = await page.request.get('/api/auth/perfil', {
    timeout: 20_000,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok()) {
    let body = '';

    try {
      body = await response.text();
    } catch {
      body = '';
    }

    throw new Error(
      `Falha ao consultar sessão.\n` +
        `HTTP: ${response.status()}\n` +
        `Resposta: ${body}`
    );
  }

  const dados = await response.json();

  return dados.usuario || dados;
}

test.beforeAll(
  async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();

    try {
      const pageA = await ctxA.newPage();
      const pageB = await ctxB.newPage();

      await login(pageA, USER_A);
      await login(pageB, USER_B);

      stateA = await ctxA.storageState();
      stateB = await ctxB.storageState();

      console.log('========================================');
      console.log('SESSÕES E2E PREPARADAS');
      console.log('========================================');
      console.log('USER_A:', USER_A.email);
      console.log('USER_B:', USER_B.email);
      console.log('Cookies USER_A:', stateA.cookies.length);
      console.log('Cookies USER_B:', stateB.cookies.length);
      console.log('========================================');
    } finally {
      await Promise.all([
        ctxA.close(),
        ctxB.close(),
      ]);
    }
  },
  {
    timeout: 180_000,
  }
);

test.describe(
  'Isolamento de sessão multi-dispositivo',
  () => {
    test(
      'cenário 1 — contas diferentes em dispositivos diferentes não se misturam',
      async ({ browser }) => {
        const ctxA = await browser.newContext({
          storageState: stateA,
        });

        const ctxB = await browser.newContext({
          storageState: stateB,
        });

        try {
          const pageA = await ctxA.newPage();
          const pageB = await ctxB.newPage();

          const identidadeA =
            await identidadeDaSessao(pageA);

          const identidadeB =
            await identidadeDaSessao(pageB);

          expect(identidadeA).toBeTruthy();
          expect(identidadeB).toBeTruthy();

          expect(identidadeA.id).not.toBe(
            identidadeB.id
          );

          expect(identidadeA.nome).not.toBe(
            identidadeB.nome
          );
        } finally {
          await ctxA.close();
          await ctxB.close();
        }
      }
    );

    test(
      'cenário 2 — mesma conta em dois dispositivos mantém identidade igual',
      async ({ browser }) => {
        const ctxA = await browser.newContext({
          storageState: stateA,
        });

        const ctxB = await browser.newContext({
          storageState: stateA,
        });

        try {
          const pageA = await ctxA.newPage();
          const pageB = await ctxB.newPage();

          const identidadeA =
            await identidadeDaSessao(pageA);

          const identidadeB =
            await identidadeDaSessao(pageB);

          expect(identidadeA.id).toBe(
            identidadeB.id
          );

          expect(identidadeA.nome).toBe(
            identidadeB.nome
          );
        } finally {
          await ctxA.close();
          await ctxB.close();
        }
      }
    );

    test(
      'cenário 3 — logout num dispositivo não derruba sessão do outro',
      async ({ browser }) => {
        const ctxA = await browser.newContext({
          storageState: stateA,
        });

        const ctxB = await browser.newContext({
          storageState: stateA,
        });

        try {
          const pageA = await ctxA.newPage();
          const pageB = await ctxB.newPage();

          const identidadeA =
            await identidadeDaSessao(pageA);

          const identidadeB =
            await identidadeDaSessao(pageB);

          expect(identidadeA.id).toBe(
            identidadeB.id
          );

          const logoutResponse =
            await pageA.request.post(
              '/api/auth/logout',
              {
                headers: {
                  Accept: 'application/json',
                },
              }
            );

          expect(logoutResponse.ok()).toBeTruthy();

          const perfilAposLogout =
            await pageA.request.get(
              '/api/auth/perfil',
              {
                headers: {
                  Accept: 'application/json',
                },
              }
            );

          expect(
            perfilAposLogout.status()
          ).toBe(401);

          const identidadeDepoisB =
            await identidadeDaSessao(pageB);

          expect(identidadeDepoisB).toBeTruthy();

          expect(
            identidadeDepoisB.id
          ).toBe(identidadeB.id);
        } finally {
          await ctxA.close();
          await ctxB.close();
        }
      }
    );

    test(
      'cenário 4 — refresh simultâneo nos dois dispositivos não troca identidade',
      async ({ browser }) => {
        const ctxA = await browser.newContext({
          storageState: stateA,
        });

        const ctxB = await browser.newContext({
          storageState: stateB,
        });

        try {
          const pageA = await ctxA.newPage();
          const pageB = await ctxB.newPage();

          await Promise.all([
            pageA.goto('/', {
              waitUntil: 'commit',
              timeout: 30_000,
            }),

            pageB.goto('/', {
              waitUntil: 'commit',
              timeout: 30_000,
            }),
          ]);

          const identidadeAntesA =
            await identidadeDaSessao(pageA);

          const identidadeAntesB =
            await identidadeDaSessao(pageB);

          expect(
            identidadeAntesA.id
          ).not.toBe(
            identidadeAntesB.id
          );

          await Promise.all([
            pageA.reload({
              waitUntil: 'commit',
              timeout: 30_000,
            }),

            pageB.reload({
              waitUntil: 'commit',
              timeout: 30_000,
            }),
          ]);

          const identidadeDepoisA =
            await identidadeDaSessao(pageA);

          const identidadeDepoisB =
            await identidadeDaSessao(pageB);

          expect(
            identidadeDepoisA.id
          ).toBe(
            identidadeAntesA.id
          );

          expect(
            identidadeDepoisB.id
          ).toBe(
            identidadeAntesB.id
          );

          expect(
            identidadeDepoisA.id
          ).not.toBe(
            identidadeDepoisB.id
          );
        } finally {
          await ctxA.close();
          await ctxB.close();
        }
      }
    );

    test(
      'cenário 5 — sessão expirada numa conta não afecta a outra',
      async ({ browser }) => {
        const ctxA = await browser.newContext({
          storageState: stateA,
        });

        const ctxB = await browser.newContext({
          storageState: stateB,
        });

        try {
          const pageA = await ctxA.newPage();
          const pageB = await ctxB.newPage();

          const identidadeAntesB =
            await identidadeDaSessao(pageB);

          expect(identidadeAntesB).toBeTruthy();

          expect(
            identidadeAntesB.id
          ).toBeTruthy();

          await ctxA.clearCookies();

          const perfilA =
            await pageA.request.get(
              '/api/auth/perfil',
              {
                headers: {
                  Accept: 'application/json',
                },
              }
            );

          expect(
            perfilA.status()
          ).toBe(401);

          const identidadeDepoisB =
            await identidadeDaSessao(pageB);

          expect(identidadeDepoisB).toBeTruthy();

          expect(
            identidadeDepoisB.id
          ).toBe(
            identidadeAntesB.id
          );
        } finally {
          await ctxA.close();
          await ctxB.close();
        }
      }
    );
  }
);