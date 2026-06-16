# Apresentação PowerPoint - Sistema de Gestão Escolar
## Guia de Slides (13 Slides)

---

## **SLIDE 1: Capa**
- **Título Principal:** Implementação de um Sistema de Gestão Escolar para o Colégio Mara e Lu
- **Subtítulo:** Sistema de Informação
- **Autor:** Adnircio do Rosário Quiteculo Inocêncio (Nº 52063)
- **Orientador:** Plácido Dias
- **Instituição:** Universidade Metodista de Angola - Faculdade de Engenharia e Arquitectura
- **Data:** Junho de 2025
- **Fundo:** Cores da escola (azul/verde) ou simples

---

## **SLIDE 2: Problema e Motivação**
- **Título:** Por que um Sistema de Gestão Escolar?
- **Conteúdo:**
  - ❌ Processos 100% manuais (fichas, planilhas)
  - ❌ Perda e duplicidade de dados
  - ❌ Lentidão na triagem de inscrições
  - ❌ Dificuldade no controlo administrativo
  - ✅ **Solução:** Sistema informatizado integrado
  - Estatística: 70% das escolas em Angola ainda usam fichas físicas

---

## **SLIDE 3: Objectivos do Sistema**
- **Título:** Objectivos Principais
- **Conteúdo (em tópicos/ícones):**
  - 📋 Automatizar inscrições e triagem
  - 👥 Centralizar gestão de alunos e turmas
  - 📊 Facilitar lançamento de notas e registo de faltas
  - 📚 Partilhar materiais pedagógicos
  - 🔒 Garantir segurança e integridade dos dados
  - 📈 Gerar relatórios administrativos

---

## **SLIDE 4: Requisitos Funcionais**
- **Título:** O que o Sistema Faz
- **Coluna 1:**
  - ✓ Inscrição pública com anexos
  - ✓ Triagem e validação
  - ✓ Matrículas automáticas
  - ✓ Gestão de utilizadores
  - ✓ Controle de permissões (Admin, Coordenador, Professor, Aluno)
  
- **Coluna 2:**
  - ✓ Lançamento de notas por disciplina
  - ✓ Registo e justificação de faltas
  - ✓ Gestão de turmas e disciplinas
  - ✓ Upload/download de materiais
  - ✓ Geração de relatórios

---

## **SLIDE 5: Actores e Papéis**
- **Título:** Quem Usa o Sistema?
- **Tabela/Ícones:**
  - 👨‍💼 **Administrador:** Gestão global, aprovação de inscrições
  - 📋 **Coordenador:** Triagem, validação, gestão académica
  - 👨‍🏫 **Professor:** Notas, faltas, materiais
  - 👨‍🎓 **Aluno/Encarregado:** Consulta notas, faltas, materiais
  
- **Fluxo simplificado:** Candidato → Coordenador (triagem) → Admin (aprovação) → Sistema (matrícula)

---

## **SLIDE 6: Arquitectura do Sistema**
- **Título:** Como está Organizado o Sistema?
- **Diagrama em blocos:**
  ```
  ┌─────────────────┐
  │  Front-end      │
  │  (React SPA)    │
  └────────┬────────┘
           │ REST API
  ┌────────▼────────┐
  │   Back-end      │
  │ (Node.js/Expr.) │
  └────────┬────────┘
           │
  ┌────────▼────────┐
  │  MySQL + Storage│
  │  (Base de Dados)│
  └─────────────────┘
  ```
- **Autenticação:** JWT com bcrypt para passwords

---

## **SLIDE 7: Tecnologias Utilizadas**
- **Título:** Stack Tecnológico
- **Coluna 1 - Front-end:**
  - React (SPA - Single Page Application)
  - React Router
  - Axios (HTTP Client)
  - Design Responsivo (Desktop + Mobile)

- **Coluna 2 - Back-end:**
  - Node.js + Express.js
  - JWT para autenticação
  - Bcrypt para hashing de passwords
  - Multer para upload de ficheiros

- **Coluna 3 - Dados:**
  - MySQL (Base de dados relacional)
  - Sistema de ficheiros (avatares, materiais, documentos)

---

## **SLIDE 8: Funcionalidades Principais - Parte 1**
- **Título:** Fluxo de Inscrição e Matrícula
- **Diagrama/Passos:**
  1. 📝 **Inscrição Pública:** Candidato preenche formulário + envia documentos
  2. 🔍 **Triagem:** Coordenador valida inscrição
  3. ✅ **Aprovação:** Administrador aprova ou rejeita
  4. 📚 **Matrícula:** Sistema converte em matrícula automática
  5. 🎓 **Aluno Ativo:** Aluno entra no sistema com credenciais

---

## **SLIDE 9: Funcionalidades Principais - Parte 2**
- **Título:** Gestão Académica e Pedagógica
- **3 Colunas:**
  - **Notas:**
    - Lançamento por disciplina
    - Consulta por aluno
    - Histórico de períodos
  
  - **Faltas:**
    - Registo por aula
    - Justificações
    - Relatórios por período
  
  - **Materiais:**
    - Upload por professor
    - Download por aluno
    - Organização por disciplina

---

## **SLIDE 10: Estrutura da Base de Dados**
- **Título:** Modelo de Dados (Entidades Principais)
- **Tabelas chave:**
  ```
  📊 admins, coordenadores, professores, alunos
  📋 inscrições → matriculas
  👥 turmas, disciplinas
  📝 notas, faltas, justificações
  📁 materiais
  ```
- **Validações:**
  - Unicidade de email e número de bilhete
  - Integridade referencial
  - Índices para performance

---

## **SLIDE 11: Interface e Experiência de Utilizador**
- **Título:** Interfaces Principais
- **Dashboard Admin:**
  - Painel de controlo (estatísticas)
  - Gestão de inscrições (pendentes, aprovadas)
  - Gestão de utilizadores

- **Dashboard Professor:**
  - Lista de alunos por turma
  - Lançamento de notas
  - Registo de faltas
  - Upload de materiais

- **Portal Aluno:**
  - Perfil e consulta de notas
  - Visualização de faltas
  - Download de materiais

---

## **SLIDE 12: Resultados Alcançados**
- **Título:** Benefícios e Impacto
- **Observados:**
  - ✅ Melhor organização de inscrições (fluxos centralizados)
  - ✅ Redução do tempo de processamento manual
  - ✅ Maior responsabilização através de controlo de acessos

- **Esperados:**
  - 📈 Agilidade na triagem e comunicação
  - 🔒 Dados seguros e consistentes
  - 📊 Fácil geração de relatórios
  - 🚀 Redução de erros e duplicidades

---

## **SLIDE 13: Recomendações e Conclusão**
- **Título:** Próximos Passos e Conclusão
- **Recomendações:**
  - 🔧 Deploy em produção com backups automatizados
  - ⚡ Testes de carga em cenários de pico
  - 📚 Documentação operacional completa
  - 🐳 Containerização com Docker para escalabilidade

- **Conclusão:**
  - Sistema pronto para operação
  - Arquitetura modular e extensível
  - Alinha-se com boas práticas internacionais
  - Responde às necessidades do Colégio Mara e Lu

---

## **Notas de Apresentação:**
- ⏱️ **Duração estimada:** 20-25 minutos (1.5-2 min por slide)
- 📊 **Visual:** Usar cores institucionais, gráficos e ícones
- 🎬 **Demos:** Preparar screenshots/vídeo de funcionalidades principais
- 📋 **Handout:** Disponibilizar cópia do relatório técnico
