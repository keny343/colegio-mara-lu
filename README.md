# Sistema de Matrículas e Gestão Académica — Colégio Mara & Lu

Sistema web para inscrições, matrículas, notas (modelo angolano: **3 trimestres**, 6 períodos), faltas, materiais e plano curricular.

**Stack:** React · Node.js/Express · MySQL

---

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| **[INSTALACAO.md](./INSTALACAO.md)** | Instalar noutro computador (passo a passo) |
| **[docs/RELATORIO.md](./docs/RELATORIO.md)** | Relatório completo: introdução → conclusão, UML, casos de uso, paradigmas, actores |
| **[docs/RELATORIO-E-HOSPEDAGEM.md](./docs/RELATORIO-E-HOSPEDAGEM.md)** | Plano de hospedagem gratuita (Vercel + Render + MySQL cloud) |

---

## Início rápido (já com Node e MySQL)

```bash
# 1. Base de dados (só na primeira vez)
mysql -u root -p < backend/database.sql

# 2. Backend
cd backend && npm install && cp .env.example .env
# Editar .env com senha MySQL
npm run dev

# 3. Frontend (outro terminal)
cd frontend && npm install && npm start
```

- Interface: http://localhost:3000  
- API: http://localhost:49152/api  

**Admin:** `admin@colegiomara.ao` / `Admin@123` (alterar após primeiro acesso)

---

## Papéis

| Papel | Função |
|-------|--------|
| **Admin** | Utilizadores, séries, académico, designar coordenadores |
| **Coordenador** | Inscrições e notas no seu ciclo/curso |
| **Professor** | Lançar notas, faltas, materiais |
| **Aluno** | Portal: notas por trimestre, horários, faltas |

**Notas:** `1PP`, `1PT`, `2PP`, `2PT`, `3PP`, `3PT` — ver relatório secção 14.

---

## Paradigmas (resumo)

| Paradigma | Ficheiros |
|-----------|-----------|
| **Funcional** | `backend/src/utils/academicoRules.js`, `backend/src/domain/NotasService.js`, `frontend/src/utils/notasPeriodos.js`, `roles.js` |
| **OOP** | `backend/src/domain/Aluno.js`, `NotasService.js` |
| **Imperativo** | `backend/src/controllers/`, `frontend/src/pages/` |

Detalhe completo em [docs/RELATORIO.md](./docs/RELATORIO.md).

---

## Migrações

```bash
cd backend
node scripts/migrate-academico.js      # tabelas académicas antigas
node scripts/migrate-notas-angola.js   # períodos 1PP…3PT
```

---

Desenvolvido para o **Colégio Mara & Lu**
