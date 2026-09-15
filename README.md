# Sistema de Matrículas e Gestão Académica — Colégio Mara & Lu

Sistema web para **gestão de inscrições, matrículas e atividades académicas**, desenvolvido para apoiar a administração escolar e centralizar informações de alunos, professores e demais utilizadores.

O projeto foi desenvolvido com uma arquitetura **frontend + API backend + base de dados MySQL**, com diferentes níveis de acesso de acordo com o perfil do utilizador.

> **Projeto de portfólio:** este repositório demonstra desenvolvimento Full Stack, organização de software, autenticação, controlo de acesso, integração com base de dados, testes e documentação.

---

## 🎯 Objetivo

O sistema procura digitalizar processos escolares que normalmente dependem de procedimentos manuais, permitindo centralizar:

* Inscrições e matrículas
* Gestão de alunos
* Gestão de utilizadores
* Gestão académica
* Notas
* Faltas
* Materiais e conteúdos académicos
* Informações curriculares
* Comunicação entre os diferentes perfis do sistema

---

## 👥 Perfis de acesso

O sistema possui diferentes perfis de utilizador:

| Perfil            | Responsabilidade                                                           |
| ----------------- | -------------------------------------------------------------------------- |
| **Administrador** | Gestão global do sistema e dos utilizadores                                |
| **Coordenador**   | Acompanhamento e gestão das atividades académicas sob sua responsabilidade |
| **Professor**     | Gestão das atividades relacionadas com as suas disciplinas e alunos        |
| **Aluno**         | Consulta das suas informações académicas                                   |

O acesso às funcionalidades é controlado de acordo com o papel atribuído ao utilizador.

---

## ⚙️ Principais funcionalidades

### 📋 Inscrições e matrículas

* Registo de candidatos
* Processo de inscrição
* Gestão de matrículas
* Acompanhamento do estado das inscrições
* Organização das informações dos alunos

### 🎓 Gestão académica

* Organização por classes e disciplinas
* Gestão de períodos académicos
* Registo e consulta de notas
* Gestão de faltas
* Consulta de informações académicas

O modelo académico considera os períodos:

* 1º Período — Prova do Professor
* 1º Período — Prova Trimestral
* 2º Período — Prova do Professor
* 2º Período — Prova Trimestral
* 3º Período — Prova do Professor
* 3º Período — Prova Trimestral

### 👤 Gestão de utilizadores

* Criação e gestão de contas
* Controlo de perfis
* Ativação/desativação de utilizadores
* Controlo de permissões

### 🔐 Autenticação e segurança

O backend implementa mecanismos de segurança como:

* Autenticação baseada em JWT
* Cookies HTTP-only para sessão
* Proteção de rotas
* Controlo de acesso por função
* Política de palavra-passe
* Rate limiting
* Helmet
* Variáveis de ambiente para informações sensíveis

Credenciais, chaves JWT e outras informações sensíveis **não devem ser armazenadas no código-fonte**.

---

## 🏗️ Arquitetura

O projeto está dividido em três componentes principais:

```text
┌──────────────────────────────┐
│          Frontend            │
│       React.js               │
│                              │
│  Interface + Navegação       │
│  Componentes + Páginas       │
└──────────────┬───────────────┘
               │ HTTP / API
               ▼
┌──────────────────────────────┐
│           Backend            │
│       Node.js / Express      │
│                              │
│  Controllers                 │
│  Routes                      │
│  Middleware                  │
│  Autenticação                │
│  Regras de negócio           │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│          MySQL               │
│                              │
│  Utilizadores                │
│  Alunos                      │
│  Inscrições                  │
│  Dados académicos            │
│  etc.                        │
└──────────────────────────────┘
```

---

## 🛠️ Tecnologias utilizadas

### Frontend

* React 18
* React Router
* Axios
* Recharts
* Lucide React
* React Toastify
* React Testing Library
* Playwright

### Backend

* Node.js
* Express
* MySQL
* mysql2
* JWT
* bcryptjs
* Helmet
* Express Rate Limit
* Multer
* Cloudinary
* dotenv
* cookie-parser

### Ferramentas

* Git
* GitHub
* VS Code
* npm

---

## 📁 Estrutura do projeto

```text
colegio-mara-lu/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── domain/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── utils/
│   │   └── server.js
│   │
│   └── package.json
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── utils/
│   │   └── App.js
│   │
│   └── package.json
│
├── docs/
│   ├── RELATORIO.md
│   └── RELATORIO-E-HOSPEDAGEM.md
│
├── diagrams/
│
├── INSTALACAO.md
├── README.md
└── .gitignore
```

---

## 🚀 Executar localmente

### 1. Clonar o projeto

```bash
git clone https://github.com/keny343/colegio-mara-lu.git
cd colegio-mara-lu
```

### 2. Instalar dependências do backend

```bash
cd backend
npm install
```

### 3. Configurar variáveis de ambiente

Crie o arquivo:

```text
backend/.env
```

Utilize o arquivo:

```text
backend/.env.example
```

como referência.

**Nunca publique o arquivo `.env`.**

### 4. Iniciar o backend

```bash
npm run dev
```

Por padrão, a API é executada localmente em:

```text
http://localhost:49152
```

### 5. Instalar dependências do frontend

Abra outro terminal:

```bash
cd frontend
npm install
```

### 6. Iniciar o frontend

```bash
npm start
```

A aplicação ficará disponível em:

```text
http://localhost:3000
```

---

## 🧪 Testes

O projeto possui testes automatizados para diferentes partes da aplicação.

### Testes unitários

```bash
cd frontend
npm test
```

### Testes E2E

```bash
cd frontend
npm run test:e2e
```

Os testes cobrem, entre outros aspetos:

* Autenticação
* Fluxos críticos da aplicação
* Isolamento de sessões
* Regras de acesso por função
* Serviços da API
* Tratamento de erros
* Hooks React
* Fluxos de utilização do sistema

---

## 🔒 Boas práticas de segurança

O projeto utiliza variáveis de ambiente para configurações sensíveis.

Exemplo:

```env
JWT_SECRET=uma_chave_longa_e_aleatoria
```

Não coloque no Git:

```text
.env
senhas
tokens
API keys
credenciais de bases de dados
segredos de produção
```

O `.gitignore` do projeto já contempla os principais ficheiros e diretórios que não devem ser versionados.

---

## 📚 Documentação

Documentação adicional disponível no repositório:

* [`INSTALACAO.md`](./INSTALACAO.md) — instalação e configuração
* [`docs/RELATORIO.md`](./docs/RELATORIO.md) — documentação do projeto
* [`docs/RELATORIO-E-HOSPEDAGEM.md`](./docs/RELATORIO-E-HOSPEDAGEM.md) — informações sobre hospedagem e configuração
* [`diagrams/`](./diagrams/) — diagramas relacionados ao sistema

---

## 🌐 Ambiente de produção

O projeto foi estruturado para utilização em ambiente de produção, com:

* Frontend hospedado na Vercel
* Backend hospedado no Render
* Base de dados MySQL
* Configuração através de variáveis de ambiente

API:

```text
https://colegio-mara-lu-backend.onrender.com
```

---

## 📈 Próximos passos

Algumas melhorias futuras previstas para a evolução do projeto:

* [ ] Expandir cobertura de testes automatizados
* [ ] Melhorar documentação da API
* [ ] Adicionar pipeline CI/CD
* [ ] Melhorar observabilidade e logs
* [ ] Adicionar documentação de arquitetura mais detalhada
* [ ] Criar documentação da API com Swagger/OpenAPI
* [ ] Melhorar continuamente a experiência de utilização
* [ ] Criar releases versionadas

---

## 💡 O que este projeto demonstra

Este projeto foi desenvolvido com o objetivo de resolver um problema real de gestão escolar e, ao mesmo tempo, aplicar conceitos de desenvolvimento de software.

Entre as competências demonstradas estão:

* Desenvolvimento Full Stack
* Desenvolvimento de APIs REST
* React
* Node.js e Express
* MySQL
* Autenticação e autorização
* Controlo de acesso baseado em funções
* Segurança de aplicações web
* Testes automatizados
* Git e GitHub
* Organização de projetos
* Documentação técnica
* Deploy de aplicações web

---

## 👨‍💻 Autor

**Adnírcio Inocêncio**

Estudante de Engenharia Informática e desenvolvedor interessado em desenvolvimento **Full Stack**, backend, bases de dados, segurança e engenharia de software.

GitHub:

https://github.com/keny343

---

## 🏫 Contexto

Projeto desenvolvido para o **Colégio Mara & Lu**, com foco na digitalização dos processos de inscrição, matrícula e gestão académica.

---

## 📄 Licença

Este projeto é disponibilizado para fins académicos e de portfólio.
