const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware, staffMiddleware, professorMiddleware, notasAccessMiddleware } = require('../middleware/auth');

const { register, login, perfil, atualizarPerfil, uploadAvatar, atualizarFotoPerfil, atualizarCredenciais } = require('../controllers/authController');
const { inscreverAluno, uploadPublicInscricao } = require('../controllers/publicController');
const { listarAlunos, criarAluno, atualizarAluno, removerAluno } = require('../controllers/alunosController');
const { minhasInscricoes, criarInscricao, cancelarInscricao, listarTodas, detalhesInscricao, atualizarStatus, dashboardStats } = require('../controllers/inscricoesController');
const { listarSeries, criarSerie, atualizarSerie, deletarSerie, upload, enviarDocumento, atualizarDocumento, listarMeusDocumentos, listarUsuarios, listarEquipaCoordenador, criarUsuario, atualizarUsuario, designarCoordenador, minhasNotificacoes, marcarNotificacaoLida, enviarNotificacao, listarContatosPermitidos, sincronizarVagasSeries } = require('../controllers/extrasController');
const {
  listarCursos, criarCurso, atualizarCurso, removerCurso,
  listarDisciplinas, criarDisciplina, atualizarDisciplina,
  listarTurmas, criarTurma, atualizarTurma,
  atribuirProfessor,
  minhasDisciplinas, alunosDaTurma,
  lancarFalta,   listarTodosHorarios, listarHorariosTurma, criarHorario, removerHorario,
  alunosDaTurmaStaff, lancarNota, notasDaTurma,
  criarMatricula, listarAlunosParaMatricula
} = require('../controllers/academicoController');
const {
  uploadMaterial, uploadPlano,
  listarMateriaisProfessor, enviarMaterial, listarMateriaisRecebidos,
  enviarPlanoCurricular, listarPlanosCurriculares, professorPainelResumo,
} = require('../controllers/materiaisController');

// AUTH
router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/perfil', authMiddleware, perfil);
router.put('/auth/perfil', authMiddleware, atualizarPerfil);
router.post('/auth/perfil/foto', authMiddleware, uploadAvatar.single('foto'), atualizarFotoPerfil);
router.put('/auth/credenciais', authMiddleware, atualizarCredenciais);

// PÚBLICO: inscrição do aluno (cria conta inativa até aprovação)
router.post(
  '/public/inscricoes',
  uploadPublicInscricao.fields([
    { name: 'bi_arquivo', maxCount: 1 },
    { name: 'historico_arquivo', maxCount: 1 },
  ]),
  inscreverAluno
);

// ALUNOS (usuário)
router.get('/alunos', authMiddleware, listarAlunos);
router.post('/alunos', authMiddleware, criarAluno);
router.put('/alunos/:id', authMiddleware, atualizarAluno);
router.delete('/alunos/:id', authMiddleware, removerAluno);

// INSCRIÇÕES (usuário)
router.get('/inscricoes/minhas', authMiddleware, minhasInscricoes);
router.post('/inscricoes', authMiddleware, criarInscricao);
router.patch('/inscricoes/:id/cancelar', authMiddleware, cancelarInscricao);

// SÉRIES (público para leitura)
router.get('/series', listarSeries);

// DOCUMENTOS (usuário)
router.post('/documentos', authMiddleware, upload.single('arquivo'), enviarDocumento);
router.get('/documentos', authMiddleware, listarMeusDocumentos);

// NOTIFICAÇÕES
router.get('/notificacoes', authMiddleware, minhasNotificacoes);
router.patch('/notificacoes/:id/lida', authMiddleware, marcarNotificacaoLida);
router.post('/notificacoes', authMiddleware, enviarNotificacao);
router.get('/mensagens/contactos', authMiddleware, listarContatosPermitidos);

// ===== ROTAS ADMIN + COORDENADOR =====
router.get('/admin/dashboard', staffMiddleware, dashboardStats);
router.get('/admin/inscricoes', staffMiddleware, listarTodas);
router.get('/admin/inscricoes/:id', staffMiddleware, detalhesInscricao);
router.patch('/admin/inscricoes/:id/status', staffMiddleware, atualizarStatus);
router.patch('/admin/documentos/:id', staffMiddleware, atualizarDocumento);

router.post('/admin/series', adminMiddleware, criarSerie);
router.put('/admin/series/:id', adminMiddleware, atualizarSerie);
router.delete('/admin/series/:id', adminMiddleware, deletarSerie);

// ===== ROTAS SÓ ADMIN =====
router.get('/admin/usuarios', adminMiddleware, listarUsuarios);
router.post('/admin/usuarios', adminMiddleware, criarUsuario);
router.put('/admin/usuarios/:id', adminMiddleware, atualizarUsuario);
router.patch('/admin/usuarios/:id/coordenador', adminMiddleware, designarCoordenador);
router.get('/staff/usuarios', staffMiddleware, listarUsuarios);
router.get('/staff/equipa', staffMiddleware, listarEquipaCoordenador);
router.post('/admin/series/sincronizar-vagas', adminMiddleware, sincronizarVagasSeries);

// ===== ACADÉMICO (admin/coordenador) =====
router.get('/staff/cursos', staffMiddleware, listarCursos);
router.post('/staff/cursos', adminMiddleware, criarCurso);
router.put('/staff/cursos/:id', adminMiddleware, atualizarCurso);
router.delete('/staff/cursos/:id', adminMiddleware, removerCurso);

router.get('/staff/disciplinas', staffMiddleware, listarDisciplinas);
router.post('/staff/disciplinas', staffMiddleware, criarDisciplina);
router.put('/staff/disciplinas/:id', staffMiddleware, atualizarDisciplina);

router.get('/staff/turmas', staffMiddleware, listarTurmas);
router.post('/staff/turmas', adminMiddleware, criarTurma);
router.put('/staff/turmas/:id', adminMiddleware, atualizarTurma);
router.post('/staff/atribuir-professor', staffMiddleware, atribuirProfessor);

// ===== PORTAL DO ALUNO =====
const { minhaMatricula, minhasDisciplinasAluno, meusHorarios, minhasNotas, minhasFaltas } = require('../controllers/alunoPortalController');
router.get('/aluno/matricula',    authMiddleware, minhaMatricula);
router.get('/aluno/disciplinas',  authMiddleware, minhasDisciplinasAluno);
router.get('/aluno/horarios',     authMiddleware, meusHorarios);
router.get('/aluno/notas',        authMiddleware, minhasNotas);
router.get('/aluno/faltas',       authMiddleware, minhasFaltas);

// ===== PROFESSOR =====
router.get('/professor/minhas-disciplinas', professorMiddleware, minhasDisciplinas);
router.get('/professor/painel', professorMiddleware, professorPainelResumo);
router.get('/professor/materiais', professorMiddleware, listarMateriaisProfessor);
router.post('/professor/materiais', professorMiddleware, uploadMaterial.single('arquivo'), enviarMaterial);
router.get('/materiais/recebidos', authMiddleware, listarMateriaisRecebidos);
router.get('/planos-curriculares', authMiddleware, listarPlanosCurriculares);
router.post('/staff/plano-curricular', staffMiddleware, uploadPlano.single('arquivo'), enviarPlanoCurricular);
router.get('/professor/alunos/:turma_id', professorMiddleware, alunosDaTurma);
router.post('/professor/faltas', professorMiddleware, lancarFalta);

router.post('/staff/notas', notasAccessMiddleware, lancarNota);
router.get('/staff/turmas/:turma_id/notas/:disciplina_id', notasAccessMiddleware, notasDaTurma);
router.post('/professor/notas', notasAccessMiddleware, lancarNota);
router.get('/professor/turmas/:turma_id/notas/:disciplina_id', notasAccessMiddleware, notasDaTurma);

// ===== HORÁRIOS ACADÉMICOS (admin/coordenador) =====
router.get('/staff/horarios', staffMiddleware, listarTodosHorarios);
router.get('/staff/horarios/:turma_id', staffMiddleware, listarHorariosTurma);
router.post('/staff/horarios', staffMiddleware, criarHorario);
router.delete('/staff/horarios/:id', staffMiddleware, removerHorario);
router.get('/staff/turmas/:id/alunos', staffMiddleware, alunosDaTurmaStaff);
router.get('/staff/alunos-para-matricula', staffMiddleware, listarAlunosParaMatricula);
router.post('/staff/matriculas', staffMiddleware, criarMatricula);

module.exports = router;
// ===== JUSTIFICAÇÃO DE FALTAS =====
const { justificarFalta, listarPedidosJustificacao, decidirJustificacao } = require('../controllers/justificacoesController');
const uploadJustif = require('multer')({ dest: 'uploads/', limits: { fileSize: 10 * 1024 * 1024 } });
router.post('/aluno/faltas/justificar', authMiddleware, uploadJustif.single('documento'), justificarFalta);
router.get('/professor/justificacoes', professorMiddleware, listarPedidosJustificacao);
router.patch('/professor/justificacoes/:id', professorMiddleware, decidirJustificacao);