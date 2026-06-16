UNIVERSIDADE METODISTA DE ANGOLA 
FACULDADE DE ENGENHARIA E ARQUITECTURA CURSO DE ENGENHARIA INFORMÁTICA

Tema: Sistemas de Informação
Título: "Implementação de um Sistema de Gestão Escolar para o Colégio Mara e Lu”

Nome: Adnircio do Rosário Quiteculo Inocêncio
Nº: 52063
Luanda, Junho de 2025

"Trabalho apresentado à Universidade Metodista de Angola como requisito parcial para a obtenção da nota na disciplina de projecto informatico"

Orientador: Plácido dias

Luanda Maio de 2025

DEDICATÓRIA
Dedico este trabalho aos meus pais e a todos que apoiaram a minha formação.

AGRADECIMENTOS
Agradeço ao orientador, colegas e à equipe do Colégio Mara e Lu pelo apoio no levantamento de requisitos e testes do sistema.

SUMÁRIO

1. Capa e Identificação
2. RESUMO / ABSTRACT
3. INTRODUÇÃO
4. LEVANTAMENTO DE REQUISITOS
 4.1 Requisitos Funcionais (RF)
 4.2 Requisitos Não Funcionais (RNF)
5. ANÁLISE DO SISTEMA
6. PROJETO DO SISTEMA
7. TECNOLOGIAS UTILIZADAS
8. IMPLEMENTAÇÃO
9. TESTES
10. RESULTADOS
11. CONCLUSÃO
12. REFERÊNCIAS
13. ANEXOS

2. RESUMO / ABSTRACT

RESUMO
O presente trabalho descreve a concepção, implementação e avaliação de um Sistema de Gestão Escolar desenvolvido para o Colégio Mara e Lu. A solução centraliza funcionalidades essenciais da gestão escolar: inscrições públicas e triagem, matrículas, gestão de alunos, lançamento de notas, registo de faltas, gestão de turmas e disciplinas, partilha de materiais.

Palavras-chave: Gestão Escolar, Matrículas, Notas, Faltas, Node.js, React, MySQL.

ABSTRACT
The present work describes the design, implementation, and evaluation of a School Management System developed for Colégio Mara e Lu. The solution centralizes essential school management functionalities: public enrollment and screening, registration, student management, grade entry, attendance recording, class and subject management, and material sharing.

3. INTRODUÇÃO

Nas últimas décadas, o avanço da tecnologia da informação tem impulsionado a transformação digital em diversos setores, incluindo a educação. A informatização de processos administrativos e pedagógicos tornou-se uma tendência global, adotada como estratégia para otimizar a gestão escolar, melhorar a comunicação com a comunidade educativa e garantir maior transparência e eficiência na tomada de decisões. Segundo a UNESCO (2023), sistemas educacionais que adotam tecnologias digitais para gerir inscrições, matrículas, notas e desempenho estudantil apresentam melhores índices de organização, equidade e eficiência operacional.

No continente africano, os desafios para a modernização da educação são significativos, mas crescentes iniciativas têm promovido a digitalização em escolas e universidades. Organizações como a União Africana e o Banco Africano de Desenvolvimento vêm investindo em projectos que visam informatizar a gestão escolar, reconhecendo que o uso da tecnologia contribui para combater a exclusão educacional, facilitar o acesso à informação e fortalecer a administração das instituições de ensino (African Union, 2024).

Em Angola, apesar dos avanços na infraestrutura educacional, muitas instituições ainda operam de forma manual, especialmente na gestão de inscrições, matrículas, lançamento de notas e registo de faltas. Isso acarreta problemas como perda de dados, duplicidade de registos, lentidão nos processos e dificuldade de controlo administrativo. Dados do Instituto Nacional de Estatística (INE) e do Ministério da Educação (2024) indicam que mais de 70% das escolas públicas e privadas ainda utilizam fichas físicas ou planilhas manuais para gerir a administração académica, o que compromete a eficiência operacional e a experiência dos alunos e seus encarregados.

O Colégio Mara e Lu, localizado em Luanda, representa um caso real deste contexto. Enfrentando dificuldades recorrentes com processos manuais (inscrições, matrículas, lançamento de notas, registo de faltas e gestão de turmas), a administração decidiu investir em uma solução informatizada, com o objectivo de automatizar o fluxo de admissões e operações académicas, reduzir falhas operacionais e facilitar o trabalho dos gestores e professores.

Diante disso, o presente trabalho tem como objectivo apresentar a concepção, desenvolvimento e implementação de um Sistema de Gestão Escolar informatizado, criado especialmente para o Colégio Mara e Lu. Utilizando tecnologias web modernas (React, Node.js, Express e MySQL), o sistema visa melhorar a eficiência, organização e segurança das informações, integrando funcionalidades essenciais: inscrição pública, aprovação administrativa, matrícula, gestão de alunos e turmas, lançamento de notas, registo de faltas, gestão de materiais e geração de relatórios. A solução alinha-se às boas práticas internacionais e às necessidades locais da educação angolana.

4. LEVANTAMENTO DE REQUISITOS

4.1 Requisitos Funcionais (RF)
- RF01: Permitir inscrição pública de candidatos com envio de documentos e anexos.
- RF02: Validar e triagem das inscrições por um administrador/coordenador.
- RF03: Efetuar matrícula de candidatos aprovados em turmas e anos letivos.
- RF04: Gerir perfis de utilizadores (admin, coordenador, professor, aluno/encarregado).
- RF05: Registrar e consultar notas por disciplina e por período.
- RF06: Registar faltas por aula e por aluno; permitir justificações.
- RF07: Gerir turmas, disciplinas e atribuição de professores.
- RF08: Publicar e partilhar materiais pedagógicos (upload/download).
- RF09: Gerar relatórios administrativos (lista de inscritos, matrículas, estatísticas de faltas/notas).
- RF10: Autenticar utilizadores via JWT e controlar permissões por papel.

4.2 Requisitos Não Funcionais (RNF)
- RNF01: Disponibilidade razoável (e.g., 99% em horários de expediente escolar).
- RNF02: Performance: respostas da API em < 500ms para operações CRUD típicas em ambiente de produção modesto.
- RNF03: Segurança: passwords com hash (bcrypt), comunicações via HTTPS em produção.
- RNF04: Persistência: backup periódico da base de dados e políticas de retenção para uploads.
- RNF05: Usabilidade: interface web responsiva para desktop e mobile.
- RNF06: Escalabilidade: arquitectura em camadas que permita deploy em containers.

5. ANÁLISE DO SISTEMA

5.1 Actores principais
- Administrador: gestão global do sistema, configuração e aprovação de inscrições.
- Coordenador: triagem e validação de inscrições; gestão académica (turmas/disciplina).
- Professor: lançamento de notas, registo de faltas e disponibilização de materiais.
- Aluno/Encarregado: consulta de notas, faltas e materiais; submissão de inscrições (quando aplicável).

5.2 Funcionamento geral
O sistema opera como uma aplicação cliente‑servidor: o front‑end em React consome uma API REST construída em Node.js/Express; os uploads são guardados em disco/local e os dados estruturados em MySQL. O fluxo típico de inscrição envolve: submissão pelo candidato → notificação ao coordenador → triagem/validação → decisão administrativa → inscrição convertida em matrícula.

5.3 Casos de uso e diagramas
Os casos de uso principais e diagramas de apoio encontram‑se em [docs/caso_de_uso.puml](docs/caso_de_uso.puml), [docs/diagrama_conceitual.puml](docs/diagrama_conceitual.puml) e [docs/diagrama_er.puml](docs/diagrama_er.puml). Estes ficheiros podem ser renderizados com PlantUML para imagens.

6. PROJETO DO SISTEMA

6.1 Arquitectura
Arquitectura cliente‑servidor com separação clara de responsabilidades: front‑end (SPA React) para UX e interacção; back‑end (REST API) para lógica de negócio, autenticação e persistência; base de dados MySQL para armazenamento persistente. A aplicação usa JWT para autenticação e middleware para controlo de acesso.

6.2 Modelagem de dados
O modelo físico inclui tabelas principais: `admins`, `alunos`, `inscricoes`, `matriculas`, `turmas`, `disciplinas`, `notas`, `faltas`. Restrições e índices garantem unicidade (e.g., email, número de bilhete) e performance em buscas por status e datas. Scripts de criação e migração estão em `backend/database.sql` e `backend/scripts/`.

6.3 Interfaces e protótipos
O front‑end contém páginas para login, dashboard por papel, gestão de inscrições, matrículas, lançamento de notas, registo de faltas e repositório de materiais. Os ficheiros de interface relevantes encontram‑se em `frontend/src/pages/` e `frontend/src/components/`.

7. TECNOLOGIAS UTILIZADAS

- Front‑end: React (SPA), React Router, Axios — código em [frontend/src/](frontend/src/)
- Back‑end: Node.js, Express, bcrypt, jsonwebtoken (JWT), Multer — código em [backend/src/](backend/src/)
- Banco de dados: MySQL — scripts em [backend/database.sql](backend/database.sql)
- Armazenamento: sistema de ficheiros (`uploads/`) para avatares, materiais e documentos
- Ferramentas: PlantUML para diagramas, nodemon para desenvolvimento, dotenv para configuração

8. IMPLEMENTAÇÃO

8.1 Estrutura do repositório (resumo)
- `backend/src/controllers/` — controladores HTTP (inscrições, alunos, auth, materiais)
- `backend/src/routes/` — definição de rotas e middlewares
- `backend/src/domain/` — modelos de domínio (`Aluno.js`, `NotasService.js`)
- `backend/src/utils/` — regras académicas e validações (`academicoRules.js`)
- `frontend/src/pages/` — páginas React (Login, Portal, AdminDashboard, ProfessorDashboard, etc.)
- `frontend/src/components/` — componentes de UI (Sidebar, Navbar, Toast)

8.2 Funcionalidades implementadas (mapa para ficheiros)
- Autenticação e gestão de sessões: `backend/src/controllers/authController.js` e `frontend/src/contexts/AuthContext.js`
- Inscrições públicas: `backend/src/controllers/inscricoesController.js` e páginas em `frontend/src/pages/InscricaoPublica.js`
- Matrículas e gestão de alunos: `backend/src/controllers/alunosController.js` e `frontend/src/pages/Registro.js`
- Lançamento de notas: `backend/src/controllers/academicoController.js` e `frontend/src/pages/ProfessorMateriais.js` (interfaces para professores)
- Registo de faltas: `backend/src/controllers/faltasController.js` (quando existente) e páginas em `frontend/src/pages/Faltas.js`
- Upload e partilha de materiais: `backend/src/controllers/materiaisController.js` e `frontend/src/pages/PortalMateriais.js`

8.3 Observações de implementação
Autenticação por JWT, hashing de passwords com bcrypt, upload de ficheiros com Multer. A aplicação organiza regras de negócio em `utils/` e entidades em `domain/` para facilitar testes e manutenção.

9. TESTES

9.1 Testes realizados
Foram realizados testes manuais de fluxo (inscrição → triagem → matrícula), testes de usabilidade com um pequeno grupo da equipa escolar e testes de integração básica das APIs com o front‑end. Não se executaram testes automatizados de unidade nem de carga no ambiente local durante o desenvolvimento (recomenda‑se implementar CI para isso).

9.2 Plano de testes recomendados
- Testes unitários: funções puras em `backend/src/utils/` e serviços em `backend/src/domain/` (usar Jest).
- Testes de integração: endpoints principais em `backend/src/controllers/` (usar Supertest + Jest).
- Testes E2E: fluxos críticos (inscrição completa, matrícula, lançamento de notas) com Cypress ou Playwright.
- Testes de carga: simular picos de inscrições simultâneas (usando k6 ou Artillery) para validar os RNF de performance.

10. RESULTADOS

10.1 Resultados observados
- Melhoria da organização de inscrições e matrículas (fluxos centralizados);
- Redução do tempo médio de processamento manual nas simulações realizadas com a equipa;
- Integração de controle de acessos por papéis, resultando em maior responsabilização.

10.2 Resultados esperados
- Maior controlo sobre os processos académicos e administrativos;
- Redução de erros manuais e duplicidades;
- Agilidade na triagem e comunicação com encarregados;
- Dados seguros, consistentes e organizados;
- Facilidade para geração de relatórios administrativos e pedagógicos.

11. CONCLUSÃO

O Sistema de Gestão Escolar implementado para o Colégio Mara e Lu integra funcionalidades centrais da administração académica e pedagógica: inscrição, matrícula, gestão de alunos, lançamento de notas, registo de faltas, gestão de turmas e distribuição de materiais. A solução demonstrou ganhos em eficiência operacional, integridade dos dados e transparência nas decisões administrativas.

A separação de permissões por papéis (admin, coordenador, professor, aluno) e a aplicação de validações server-side reduziram erros e melhoraram a responsabilização. A arquitectura modular (camada de regras funcionais, entidades de domínio OOP e controladores imperativos) facilita manutenção, testes e extensibilidade.

Recomendações finais:

- Disponibilizar um ambiente de produção com backups automatizados e políticas de retenção;
- Realizar testes de carga e concorrência em cenários de inscrição massiva e operações simultâneas de professores;
- Documentar operações administrativas e planos de recuperação;
- Planejar o deploy em ambientes geridos com containers e banco de dados gerenciado para maior disponibilidade e segurança.

12. REFERÊNCIAS

- UNESCO. (2023). Digital transformation of education systems: A framework for action.
- Ministério da Educação de Angola. (2024). Plano Nacional de Melhoria da Gestão Escolar.
- Documentação React, Express e MySQL.

13. ANEXOS

- Diagramas PlantUML: [docs/caso_de_uso.puml](docs/caso_de_uso.puml), [docs/diagrama_conceitual.puml](docs/diagrama_conceitual.puml), [docs/diagrama_er.puml](docs/diagrama_er.puml)
- Scripts e migrações: [backend/database.sql](backend/database.sql) e [backend/scripts/](backend/scripts/)
- Código‑fonte: [backend/src/](backend/src/) e [frontend/src/](frontend/src/)
- Uploads e amostras: pasta `uploads/` (avatars, materiais, planos)

Documento reorganizado a partir do conteúdo original — nenhuma informação foi removida, apenas reordenada e complementada para corresponder à estrutura solicitada pelo docente.
