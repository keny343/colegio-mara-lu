# Guia de instalação — Colégio Mara & Lu  
## Executar o sistema noutro computador (Windows, macOS ou Linux)

Este guia permite instalar o projecto **do zero** noutra máquina.  
**Não é necessário recriar a base de dados** se já migrou uma cópia `.sql` ou se só actualiza o código — veja a secção [Base de dados já existente](#base-de-dados-já-existente).

---

## 1. O que precisa

| Software | Versão mínima | Verificar |
|----------|---------------|-----------|
| **Node.js** | 18+ | `node -v` |
| **npm** | 9+ | `npm -v` |
| **MySQL** | 8+ | MySQL Workbench ou serviço MySQL activo |

---

## 2. Obter o projecto

**Opção A — Git**

```bash
git clone <url-do-repositorio> colegio-mara-lu
cd colegio-mara-lu
```

**Opção B — Pasta copiada**

Copie a pasta completa `colegio-mara-lu` para o novo PC (USB, rede, etc.).

---

## 3. Base de dados (instalação nova)

### 3.1 Criar base e tabelas

No **MySQL Workbench** ou linha de comandos:

```bash
mysql -u root -p < backend/database.sql
```

Isto cria a base `colegio_mara_lu`, tabelas e utilizador administrador inicial.

### 3.2 Migrações em bases antigas

Se a base já existia de uma versão anterior:

```bash
cd backend
node scripts/migrate-academico.js
node scripts/migrate-notas-angola.js
```

A migração de notas converte períodos `1º`/`2º` para `1PP`, `1PT`, etc.

### Base de dados já existente

Se **só copiou o código** e a base MySQL já está no mesmo PC com dados:

- **Não** execute `database.sql` outra vez (apaga ou duplica estruturas).  
- Execute apenas as migrações acima se ainda não as correu.  
- Reinicie o backend.

---

## 4. Backend (API)

```bash
cd backend
npm install
```

Crie o ficheiro `.env` (copie de `.env.example` se existir):

```env
PORT=49152
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=SUA_SENHA_MYSQL
DB_NAME=colegio_mara_lu
JWT_SECRET=altere_para_uma_chave_longa_e_aleatoria
UPLOAD_PATH=./uploads
```

**Windows (PowerShell)** — iniciar API:

```powershell
npm run dev
```

**Linux/macOS:**

```bash
npm run dev
```

Mensagem esperada: `Servidor rodando em: http://localhost:49152`

Teste rápido no browser: `http://localhost:49152/api/test` → deve responder `{"message":"Backend OK!"}`

---

## 5. Frontend (interface)

Abra **outro terminal**:

```bash
cd frontend
npm install
npm start
```

Abre automaticamente: **http://localhost:3000**

O `package.json` do frontend tem `"proxy": "http://localhost:49152"` — a API deve usar a mesma porta do `.env`.

Se a API usar outra porta, crie `frontend/.env`:

```env
REACT_APP_API_URL=http://localhost:49152/api
```

---

## 6. Credenciais iniciais

| Papel | E-mail | Senha |
|-------|--------|-------|
| Administrador | admin@colegiomara.ao | Admin@123 |

**Altere a senha** após o primeiro acesso.

---

## 7. Papéis e rotas principais

| Papel | Entrada após login | Perfil |
|-------|-------------------|--------|
| Admin | `/admin` | `/admin/perfil` |
| Coordenador | `/admin` | `/admin/perfil` |
| Professor | `/professor` | `/professor/perfil` |
| Aluno | `/portal` | `/portal/perfil` |

**Notas:** 3 trimestres × (parcial + trimestral) — códigos `1PP`, `1PT`, `2PP`, `2PT`, `3PP`, `3PT`.

---

## 8. Estrutura de pastas importantes

| Pasta | Conteúdo |
|-------|----------|
| `backend/uploads/` | Documentos, avatars, materiais (criada automaticamente) |
| `backend/database.sql` | Script completo da BD |
| `docs/RELATORIO.md` | Relatório académico (UML, paradigmas) |
| `docs/RELATORIO-E-HOSPEDAGEM.md` | Plano de hospedagem gratuita |

---

## 9. Problemas comuns

| Problema | Solução |
|----------|---------|
| `ECONNREFUSED` no login | Backend não está a correr ou porta errada no `.env` / proxy |
| Erro MySQL access denied | Verificar `DB_USER` e `DB_PASSWORD` no `.env` |
| `Data truncated for column 'periodo'` | Executar `node backend/scripts/migrate-notas-angola.js` |
| Tabelas em falta | `node backend/scripts/migrate-academico.js` |
| Porta 3000 ocupada | `set PORT=3001` (Windows) ou `PORT=3001 npm start` |
| Fotos não aparecem | Confirmar que `backend/uploads` existe e API serve `/uploads` |

---

## 10. Produção local (opcional)

Build do frontend:

```bash
cd frontend
npm run build
```

Servir a pasta `frontend/build` com qualquer servidor estático e manter a API com `npm start` no backend.

---

## 11. Próximo passo: hospedagem online

Consulte **`docs/RELATORIO-E-HOSPEDAGEM.md`** para o plano gratuito (Render, Vercel, Railway, etc.).

---

*Colégio Mara & Lu — Sistema de Gestão Académica*
