// @ts-check

const { test, expect } = require('@playwright/test');

// ============================================================
// CONTAS E2E
// ============================================================
//
// Definir em frontend/e2e/.env:
//
// E2E_USER_A_EMAIL
// E2E_USER_A_PASSWORD
// E2E_USER_B_EMAIL
// E2E_USER_B_PASSWORD
//
// Nunca commitar credenciais reais.
// ============================================================

const USER_A = {
  email: process.env.E2E_USER_A_EMAIL,
  senha: process.env.E2E_USER_A_PASSWORD,
};

const USER_B = {
  email: process.env.E2E_USER_B_EMAIL,
  senha: process.env.E2E_USER_B_PASSWORD,
};

// Estados autenticados.
// São preenchidos uma única vez no beforeAll.
let stateA;
let stateB;

// ============================================================
// VALIDAÇÃO DAS CREDENCIAIS
// ============================================================

test.beforeAll(() => {
  if (
    !USER_A.email ||
    !USER_A.senha ||
    !USER_B.email ||
    !USER_B.senha
  ) {
    throw new Error(
      'Definir E2E_USER_A_EMAIL/PASSWORD e E2E_USER_B_EMAIL/PASSWORD ' +
        '(contas de teste seedadas na BD).'
    );
  }
});

// ============================================================
// LOGIN
// ============================================================

/**
 * Faz login de uma conta.
 *
 * O cookie httpOnly criado pelo backend fica armazenado
 * no storageState do browser context.
 */
async function login(page, user) {
  await page.goto('/login', {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });

  const campoEmail = page.locator('#login-email');
  const campoSenha = page.locator('#login-senha');

  await expect(campoEmail).toBeVisible({
    timeout: 20_000,
  });

  await expect(campoSenha).toBeVisible({
    timeout: 10_000,
  });

  await campoEmail.fill(user.email);
  await campoSenha.fill(user.senha);

  const botaoEntrar = page.getByRole('button', {
    name: /entrar/i,
  });

  await expect(botaoEntrar).toBeVisible({
    timeout: 10_000,
  });

  // Capturar a resposta real do login.
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
      body = '<não foi possível ler a resposta>';
    }

    throw new Error(
      `Login rejeitado pelo backend.\n` +
        `HTTP: ${loginResponse.status()}\n` +
        `URL: ${loginResponse.url()}\n` +
        `Resposta: ${body}`
    );
  }

  // O login deve retirar a página de /login.
  await expect(page).not.toHaveURL(/\/login/, {
    timeout: 20_000,
  });
}

// ============================================================
// IDENTIDADE DA SESSÃO
// ============================================================

/**
 * Consulta a identidade da sessão através do backend.
 *
 * O request pertence ao próprio browser context,
 * portanto utiliza os cookies desse dispositivo.
 */
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

  return await response.json();
}

// ============================================================
// PREPARAÇÃO DAS SESSÕES
// ============================================================
//
// USER_A faz login uma vez.
// USER_B faz login uma vez.
//
// Os dois logins são feitos em paralelo para reduzir
// o tempo da preparação da suíte.
//
// Os estados são reutilizados pelos cinco cenários.
//
// Isso evita múltiplos logins e reduz a possibilidade
// de atingir o rate limiter do backend.
// ============================================================

test.beforeAll(
  async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();

    try {
      const pageA = await ctxA.newPage();
      const pageB = await ctxB.newPage();

      // Login das duas contas em paralelo.
      await Promise.all([
        login(pageA, USER_A),
        login(pageB, USER_B),
      ]);

      // Guardar cookies/sessões.
      [stateA, stateB] = await Promise.all([
        ctxA.storageState(),
        ctxB.storageState(),
      ]);
    } finally {
      await Promise.all([
        ctxA.close(),
        ctxB.close(),
      ]);
    }
  },
  {
    // Timeout exclusivo da preparação das duas sessões.
    timeout: 180_000,
  }
);

// ============================================================
// TESTES
// ============================================================

test.describe('Isolamento de sessão multi-dispositivo', () => {
  // ==========================================================
  // CENÁRIO 1
  // ==========================================================

  test(
    'cenário 1 — contas diferentes em dispositivos diferentes não se misturam',
    async ({ browser }) => {
      // Dispositivo A → conta A
      const ctxA = await browser.newContext({
        storageState: stateA,
      });

      // Dispositivo B → conta B
      const ctxB = await browser.newContext({
        storageState: stateB,
      });

      try {
        const pageA = await ctxA.newPage();
        const pageB = await ctxB.newPage();

        const identidadeA = await identidadeDaSessao(pageA);
        const identidadeB = await identidadeDaSessao(pageB);

        expect(identidadeA).toBeTruthy();
        expect(identidadeB).toBeTruthy();

        // As contas devem ser diferentes.
        expect(identidadeA.id).not.toBe(identidadeB.id);

        // Os nomes das contas de teste também devem ser diferentes.
        expect(identidadeA.nome).not.toBe(identidadeB.nome);
      } finally {
        await ctxA.close();
        await ctxB.close();
      }
    }
  );

  // ==========================================================
  // CENÁRIO 2
  // ==========================================================

  test(
    'cenário 2 — mesma conta em dois dispositivos mantém identidade igual',
    async ({ browser }) => {
      // Dois dispositivos independentes usando a mesma conta A.
      const ctxA = await browser.newContext({
        storageState: stateA,
      });

      const ctxB = await browser.newContext({
        storageState: stateA,
      });

      try {
        const pageA = await ctxA.newPage();
        const pageB = await ctxB.newPage();

        const identidadeA = await identidadeDaSessao(pageA);
        const identidadeB = await identidadeDaSessao(pageB);

        // Mesmo usuário.
        expect(identidadeA.id).toBe(identidadeB.id);

        // Mesmo nome.
        expect(identidadeA.nome).toBe(identidadeB.nome);
      } finally {
        await ctxA.close();
        await ctxB.close();
      }
    }
  );

  // ==========================================================
  // CENÁRIO 3
  // ==========================================================

  test(
    'cenário 3 — logout num dispositivo não derruba sessão do outro',
    async ({ browser }) => {
      // Dois dispositivos independentes,
      // ambos usando a conta A.
      const ctxA = await browser.newContext({
        storageState: stateA,
      });

      const ctxB = await browser.newContext({
        storageState: stateA,
      });

      try {
        const pageA = await ctxA.newPage();
        const pageB = await ctxB.newPage();

        // Confirmar que ambas as sessões pertencem ao mesmo usuário.
        const identidadeA = await identidadeDaSessao(pageA);
        const identidadeB = await identidadeDaSessao(pageB);

        expect(identidadeA.id).toBe(identidadeB.id);

        // -----------------------------------------------------
        // LOGOUT SOMENTE NO DISPOSITIVO A
        // -----------------------------------------------------

        const logoutResponse =
          await pageA.request.post('/api/auth/logout', {
            headers: {
              Accept: 'application/json',
            },
          });

        expect(logoutResponse.ok()).toBeTruthy();

        // -----------------------------------------------------
        // A DEIXOU DE TER SESSÃO
        // -----------------------------------------------------

        const perfilAposLogout =
          await pageA.request.get('/api/auth/perfil', {
            headers: {
              Accept: 'application/json',
            },
          });

        expect(perfilAposLogout.status()).toBe(401);

        // -----------------------------------------------------
        // B CONTINUA AUTENTICADO
        // -----------------------------------------------------

        const identidadeDepoisB =
          await identidadeDaSessao(pageB);

        expect(identidadeDepoisB).toBeTruthy();
        expect(identidadeDepoisB.id).toBe(identidadeB.id);
      } finally {
        await ctxA.close();
        await ctxB.close();
      }
    }
  );

  // ==========================================================
  // CENÁRIO 4
  // ==========================================================

  test(
    'cenário 4 — refresh simultâneo nos dois dispositivos não troca identidade',
    async ({ browser }) => {
      // Dispositivo A → conta A
      const ctxA = await browser.newContext({
        storageState: stateA,
      });

      // Dispositivo B → conta B
      const ctxB = await browser.newContext({
        storageState: stateB,
      });

      try {
        const pageA = await ctxA.newPage();
        const pageB = await ctxB.newPage();

        // -----------------------------------------------------
        // ABRIR A APLICAÇÃO
        // -----------------------------------------------------

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

        // -----------------------------------------------------
        // IDENTIDADES ANTES DO REFRESH
        // -----------------------------------------------------

        const identidadeAntesA =
          await identidadeDaSessao(pageA);

        const identidadeAntesB =
          await identidadeDaSessao(pageB);

        expect(identidadeAntesA.id).not.toBe(
          identidadeAntesB.id
        );

        // -----------------------------------------------------
        // REFRESH SIMULTÂNEO
        // -----------------------------------------------------

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

        // -----------------------------------------------------
        // IDENTIDADES DEPOIS DO REFRESH
        // -----------------------------------------------------

        const identidadeDepoisA =
          await identidadeDaSessao(pageA);

        const identidadeDepoisB =
          await identidadeDaSessao(pageB);

        // A continua sendo A.
        expect(identidadeDepoisA.id).toBe(
          identidadeAntesA.id
        );

        // B continua sendo B.
        expect(identidadeDepoisB.id).toBe(
          identidadeAntesB.id
        );

        // A e B continuam diferentes.
        expect(identidadeDepoisA.id).not.toBe(
          identidadeDepoisB.id
        );
      } finally {
        await ctxA.close();
        await ctxB.close();
      }
    }
  );

  // ==========================================================
  // CENÁRIO 5
  // ==========================================================

  test(
    'cenário 5 — sessão expirada numa conta não afecta a outra',
    async ({ browser }) => {
      // Dispositivo A → conta A
      const ctxA = await browser.newContext({
        storageState: stateA,
      });

      // Dispositivo B → conta B
      const ctxB = await browser.newContext({
        storageState: stateB,
      });

      try {
        const pageA = await ctxA.newPage();
        const pageB = await ctxB.newPage();

        // -----------------------------------------------------
        // CONFIRMAR IDENTIDADE DE B
        // -----------------------------------------------------

        const identidadeAntesB =
          await identidadeDaSessao(pageB);

        expect(identidadeAntesB).toBeTruthy();
        expect(identidadeAntesB.id).toBeTruthy();

        // -----------------------------------------------------
        // EXPIRAR SOMENTE A SESSÃO DE A
        // -----------------------------------------------------

        await ctxA.clearCookies();

        // -----------------------------------------------------
        // A NÃO POSSUI MAIS SESSÃO
        // -----------------------------------------------------

        const perfilA =
          await pageA.request.get('/api/auth/perfil', {
            headers: {
              Accept: 'application/json',
            },
          });

        expect(perfilA.status()).toBe(401);

        // -----------------------------------------------------
        // B CONTINUA AUTENTICADO
        // -----------------------------------------------------

        const identidadeDepoisB =
          await identidadeDaSessao(pageB);

        expect(identidadeDepoisB).toBeTruthy();

        expect(identidadeDepoisB.id).toBe(
          identidadeAntesB.id
        );
      } finally {
        await ctxA.close();
        await ctxB.close();
      }
    }
  );
});