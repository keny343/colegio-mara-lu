// @ts-check

const { test, expect } = require('@playwright/test');

// ============================================================
// CONTAS E2E
// ============================================================

const USER_A = {
  email: process.env.E2E_USER_A_EMAIL,
  senha: process.env.E2E_USER_A_PASSWORD,
};

const USER_B = {
  email: process.env.E2E_USER_B_EMAIL,
  senha: process.env.E2E_USER_B_PASSWORD,
};

// ============================================================
// VALIDAÇÃO
// ============================================================

test.beforeEach(() => {
  if (
    !USER_A.email ||
    !USER_A.senha ||
    !USER_B.email ||
    !USER_B.senha
  ) {
    throw new Error(
      'Definir E2E_USER_A_EMAIL/PASSWORD e E2E_USER_B_EMAIL/PASSWORD no e2e/.env'
    );
  }
});

// ============================================================
// LOGIN
// ============================================================

async function fazerLogin(page, user) {
  await page.goto('/login', {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });

  const campoEmail = page.locator('#login-email');
  const campoSenha = page.locator('#login-senha');
  const botaoEntrar = page.getByRole('button', {
    name: /^entrar$/i,
  });

  await expect(campoEmail).toBeVisible();
  await expect(campoSenha).toBeVisible();
  await expect(botaoEntrar).toBeVisible();

  await campoEmail.fill(user.email);
  await campoSenha.fill(user.senha);

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

  const texto = await loginResponse.text();

  console.log('');
  console.log('LOGIN:', user.email);
  console.log('HTTP:', loginResponse.status());
  console.log('RESPOSTA:', texto);

  expect(loginResponse.ok()).toBeTruthy();

  let dados;

  try {
    dados = JSON.parse(texto);
  } catch {
    throw new Error(
      `Resposta de login não é JSON válido:\n${texto}`
    );
  }

  expect(dados).toBeTruthy();
  expect(dados.usuario).toBeTruthy();
  expect(dados.usuario.id).toBeTruthy();

  return dados.usuario;
}

// ============================================================
// PERFIL
// ============================================================

async function obterPerfil(page) {
  const response = await page.request.get('/api/auth/perfil', {
    timeout: 20_000,
    headers: {
      Accept: 'application/json',
    },
  });

  return response;
}

// ============================================================
// TESTE 1
// ============================================================

test(
  'login — página de login é renderizada corretamente',
  async ({ page }) => {
    await page.goto('/login', {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });

    await expect(
      page.locator('#login-email')
    ).toBeVisible();

    await expect(
      page.locator('#login-senha')
    ).toBeVisible();

    await expect(
      page.getByRole('button', {
        name: /^entrar$/i,
      })
    ).toBeVisible();

    console.log('');
    console.log('========================================');
    console.log('LOGIN RENDERIZADO CORRETAMENTE');
    console.log('========================================');
  }
);

// ============================================================
// TESTE 2
// ============================================================

test(
  'login — USER_A consegue autenticar',
  async ({ page }) => {
    const usuario = await fazerLogin(page, USER_A);

    expect(usuario).toBeTruthy();
    expect(usuario.id).toBeTruthy();
    expect(usuario.email).toBe(USER_A.email);

    await expect(page).not.toHaveURL(/\/login/, {
      timeout: 20_000,
    });

    console.log('');
    console.log('USER_A AUTENTICADO');
    console.log('ID:', usuario.id);
    console.log('NOME:', usuario.nome);
    console.log('ROLE:', usuario.role);
    console.log('URL:', page.url());
  }
);

// ============================================================
// TESTE 3
// ============================================================

test(
  'login — USER_B consegue autenticar',
  async ({ page }) => {
    const usuario = await fazerLogin(page, USER_B);

    expect(usuario).toBeTruthy();
    expect(usuario.id).toBeTruthy();
    expect(usuario.email).toBe(USER_B.email);

    await expect(page).not.toHaveURL(/\/login/, {
      timeout: 20_000,
    });

    console.log('');
    console.log('USER_B AUTENTICADO');
    console.log('ID:', usuario.id);
    console.log('NOME:', usuario.nome);
    console.log('ROLE:', usuario.role);
    console.log('URL:', page.url());
  }
);

// ============================================================
// TESTE 4
// ============================================================

test(
  'login — credenciais inválidas são rejeitadas',
  async ({ page }) => {
    await page.goto('/login', {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });

    await page.locator('#login-email').fill(
      USER_A.email
    );

    await page.locator('#login-senha').fill(
      'SENHA_E2E_INVALIDA_123456'
    );

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/auth/login') &&
        response.request().method() === 'POST',
      {
        timeout: 30_000,
      }
    );

    await page.getByRole('button', {
      name: /^entrar$/i,
    }).click();

    const response = await responsePromise;

    console.log('');
    console.log('========================================');
    console.log('LOGIN INVÁLIDO');
    console.log('HTTP:', response.status());
    console.log('========================================');

    expect(response.status()).toBe(401);

    await expect(page).toHaveURL(/\/login/);
  }
);

// ============================================================
// TESTE 5
// ============================================================

test(
  'autenticação — utilizador não autenticado recebe 401 no perfil',
  async ({ page }) => {
    const response = await obterPerfil(page);

    console.log('');
    console.log('========================================');
    console.log('PERFIL SEM AUTENTICAÇÃO');
    console.log('HTTP:', response.status());
    console.log('========================================');

    expect(response.status()).toBe(401);
  }
);

// ============================================================
// TESTE 6
// ============================================================

test(
  'logout — sessão é encerrada corretamente',
  async ({ page }) => {
    const usuario = await fazerLogin(page, USER_A);

    expect(usuario).toBeTruthy();
    expect(usuario.id).toBeTruthy();

    // ----------------------------------------------------------
    // CONFIRMAR PERFIL AUTENTICADO
    // ----------------------------------------------------------

    const perfilAntes = await obterPerfil(page);

    expect(perfilAntes.ok()).toBeTruthy();

    const dadosAntes = await perfilAntes.json();

    // IMPORTANTE:
    // /api/auth/perfil retorna diretamente o utilizador.
    //
    // NÃO:
    // dadosAntes.usuario
    //
    // SIM:
    // dadosAntes

    expect(dadosAntes).toBeTruthy();
    expect(dadosAntes.id).toBe(usuario.id);

    console.log('');
    console.log('========================================');
    console.log('PERFIL ANTES DO LOGOUT');
    console.log('ID:', dadosAntes.id);
    console.log('NOME:', dadosAntes.nome);
    console.log('========================================');

    // ----------------------------------------------------------
    // LOGOUT
    // ----------------------------------------------------------

    const logoutResponse = await page.request.post(
      '/api/auth/logout',
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );

    console.log('');
    console.log('LOGOUT HTTP:', logoutResponse.status());

    expect(logoutResponse.ok()).toBeTruthy();

    // ----------------------------------------------------------
    // PERFIL DEPOIS DO LOGOUT
    // ----------------------------------------------------------

    const perfilDepois = await obterPerfil(page);

    console.log(
      'PERFIL DEPOIS DO LOGOUT HTTP:',
      perfilDepois.status()
    );

    expect(perfilDepois.status()).toBe(401);
  }
);