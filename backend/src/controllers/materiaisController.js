const db = require('../config/database');
const path = require('path');
const { coordenadorPodeGerirTurma, temEscopoCoordenacao } = require('../utils/academicoRules');
const cloudinaryUpload = require('../config/cloudinaryUpload');

const uploadMaterial = cloudinaryUpload('materiais', 50);
const uploadPlano    = cloudinaryUpload('planos', 25);

const ensureTables = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS materiais_didaticos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      professor_id INT NOT NULL,
      turma_id INT,
      disciplina_id INT,
      titulo VARCHAR(200) NOT NULL,
      tipo VARCHAR(30) DEFAULT 'pdf',
      caminho VARCHAR(500) NOT NULL,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (professor_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS planos_curriculares (
      id INT AUTO_INCREMENT PRIMARY KEY,
      coordenador_id INT NOT NULL,
      titulo VARCHAR(200) NOT NULL,
      caminho VARCHAR(500) NOT NULL,
      nivel_coordenado VARCHAR(100),
      curso_coordenado VARCHAR(150),
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (coordenador_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `);
};

const listarMateriaisProfessor = async (req, res) => {
  try {
    await ensureTables();
    const [rows] = await db.query(
      `SELECT m.*, t.nome as turma_nome, d.nome as disciplina_nome
       FROM materiais_didaticos m
       LEFT JOIN turmas t ON m.turma_id = t.id
       LEFT JOIN disciplinas d ON m.disciplina_id = d.id
       WHERE m.professor_id = ?
       ORDER BY m.criado_em DESC`,
      [req.user.id]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const enviarMaterial = async (req, res) => {
  try {
    await ensureTables();
    if (!req.file) return res.status(400).json({ message: 'Ficheiro obrigatório.' });
    const { titulo, turma_id, disciplina_id } = req.body;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let tipo = 'outro';
    if (['.pdf'].includes(ext)) tipo = 'pdf';
    else if (['.mp4', '.webm', '.mov'].includes(ext)) tipo = 'video';
    else if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) tipo = 'imagem';

    const [r] = await db.query(
      `INSERT INTO materiais_didaticos (professor_id, turma_id, disciplina_id, titulo, tipo, caminho)
       VALUES (?,?,?,?,?,?)`,
      [
        req.user.id,
        turma_id || null,
        disciplina_id || null,
        titulo || req.file.originalname,
        tipo,
        req.file.path,
      ]
    );

    if (turma_id) {
      const [detalhes] = await db.query(
        `SELECT d.nome AS disciplina_nome, u.nome AS professor_nome
         FROM disciplinas d
         JOIN usuarios u ON u.id = ?
         WHERE d.id = ? LIMIT 1`,
        [req.user.id, disciplina_id]
      );
      const disciplinaNome = detalhes[0]?.disciplina_nome || 'disciplina';
      const [alunos] = await db.query(
        `SELECT DISTINCT a.usuario_id FROM matriculas m
         JOIN alunos a ON m.aluno_id = a.id
         WHERE m.turma_id = ? AND m.status = 'ativa' AND a.usuario_id IS NOT NULL`,
        [turma_id]
      );
      const notificacoes = alunos
        .map(row => row.usuario_id)
        .filter(Boolean)
        .map(usuario_id => [
          usuario_id,
          'Novo material didático',
          `O professor ${detalhes[0]?.professor_nome || 'do seu curso'} enviou o material "${titulo || req.file.originalname}" para a sua turma${disciplinaNome ? ` (${disciplinaNome})` : ''}.`,
          'novo_material',
        ]);
      if (notificacoes.length) {
        await db.query('INSERT INTO notificacoes (usuario_id, titulo, mensagem, tipo) VALUES ?', [notificacoes]);
      }
    }

    return res.status(201).json({ id: r.insertId, message: 'Material publicado.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const listarMateriaisRecebidos = async (req, res) => {
  try {
    await ensureTables();
    const [rows] = await db.query(
      `SELECT m.*, u.nome as professor_nome, t.nome as turma_nome, t.serie_classe, c.nome as curso_nome, d.nome as disciplina_nome
       FROM materiais_didaticos m
       JOIN usuarios u ON m.professor_id = u.id
       LEFT JOIN turmas t ON m.turma_id = t.id
       LEFT JOIN cursos c ON t.curso_id = c.id
       LEFT JOIN disciplinas d ON m.disciplina_id = d.id
       ORDER BY m.criado_em DESC LIMIT 100`
    );
    if (req.user.role === 'admin') return res.json(rows);
    if (req.user.role === 'aluno') {
      const [mat] = await db.query(
        `SELECT t.id, t.serie_classe, c.nome as curso_nome FROM matriculas m
         JOIN turmas t ON m.turma_id = t.id LEFT JOIN cursos c ON t.curso_id = c.id
         JOIN alunos a ON m.aluno_id = a.id
         WHERE a.usuario_id = ? AND m.status = 'ativa' LIMIT 1`,
        [req.user.id]
      );
      const ctx = mat[0];
      if (!ctx) return res.json([]);
      return res.json(rows.filter((r) => !r.turma_id || Number(r.turma_id) === Number(ctx.id)));
    }
    const filtered = rows.filter((r) =>
      !r.turma_id || coordenadorPodeGerirTurma(req.user, { serie_classe: r.serie_classe, curso_nome: r.curso_nome })
    );
    return res.json(filtered);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const enviarPlanoCurricular = async (req, res) => {
  try {
    await ensureTables();
    if (!req.file) return res.status(400).json({ message: 'Ficheiro obrigatório.' });
    if (!temEscopoCoordenacao(req.user) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Apenas coordenadores podem publicar o plano curricular.' });
    }
    const { titulo } = req.body;
    const [r] = await db.query(
      `INSERT INTO planos_curriculares (coordenador_id, titulo, caminho, nivel_coordenado, curso_coordenado)
       VALUES (?,?,?,?,?)`,
      [
        req.user.id,
        titulo || 'Plano curricular',
        req.file.path,
        req.user.nivel_coordenado || null,
        req.user.curso_coordenado || null,
      ]
    );

    const filtros = [];
    const valores = [];
    if (req.user.curso_coordenado) {
      filtros.push('c.nome = ?');
      valores.push(req.user.curso_coordenado);
    }
    if (req.user.nivel_coordenado) {
      const nivelMatch = String(req.user.nivel_coordenado).match(/\d+/);
      if (nivelMatch) {
        filtros.push('t.serie_classe = ?');
        valores.push(Number(nivelMatch[0]));
      }
    }
    const whereClause = filtros.length ? `WHERE ${filtros.join(' OR ')}` : '';

    const [alunos] = await db.query(
      `SELECT DISTINCT a.usuario_id FROM matriculas m
       JOIN alunos a ON m.aluno_id = a.id
       JOIN turmas t ON m.turma_id = t.id
       LEFT JOIN cursos c ON t.curso_id = c.id
       ${whereClause}`,
      valores
    );
    const [professores] = await db.query(
      `SELECT DISTINCT u.id FROM turma_professores tp
       JOIN usuarios u ON tp.professor_id = u.id
       JOIN turmas t ON tp.turma_id = t.id
       LEFT JOIN cursos c ON t.curso_id = c.id
       ${whereClause}`,
      valores
    );
    const destinatarios = new Set();
    const mensagem = `O plano curricular "${titulo || 'Plano curricular'}" foi publicado pelo coordenador.`;
    alunos.filter(row => row.usuario_id).forEach((row) => {
      destinatarios.add(row.usuario_id);
    });
    professores.filter(row => row.id).forEach((row) => {
      destinatarios.add(row.id);
    });
    const notificacoes = Array.from(destinatarios).map((usuario_id) => [usuario_id, 'Novo plano curricular', mensagem, 'plano_curricular']);
    if (notificacoes.length) {
      await db.query('INSERT INTO notificacoes (usuario_id, titulo, mensagem, tipo) VALUES ?', [notificacoes]);
    }

    return res.status(201).json({ id: r.insertId, message: 'Plano curricular publicado.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const listarPlanosCurriculares = async (req, res) => {
  try {
    await ensureTables();
    const [rows] = await db.query(
      `SELECT p.*, u.nome as coordenador_nome FROM planos_curriculares p
       JOIN usuarios u ON p.coordenador_id = u.id
       ORDER BY p.criado_em DESC LIMIT 20`
    );
    if (req.user.role === 'admin') return res.json(rows);
    if (!temEscopoCoordenacao(req.user) && req.user.role !== 'professor' && req.user.role !== 'aluno') {
      return res.json([]);
    }
    const n = (req.user.nivel_coordenado || '').toLowerCase();
    const c = req.user.curso_coordenado || '';
    const filtered = rows.filter((p) => {
      if (req.user.role === 'admin') return true;
      if (p.coordenador_id === req.user.id) return true;
      if (c && p.curso_coordenado === c) return true;
      if (n && p.nivel_coordenado && p.nivel_coordenado.includes(n.split(' ')[0])) return true;
      return false;
    });
    return res.json(filtered);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const professorPainelResumo = async (req, res) => {
  try {
    const profId = req.user.id;
    const [atrib] = await db.query(
      `SELECT tp.turma_id, tp.disciplina_id, t.nome as turma_nome, t.serie_classe, d.nome as disciplina_nome
       FROM turma_professores tp
       JOIN turmas t ON tp.turma_id = t.id
       JOIN disciplinas d ON tp.disciplina_id = d.id
       WHERE tp.professor_id = ?`,
      [profId]
    );
    const turmasIds = [...new Set(atrib.map((a) => a.turma_id))];
    let alunos = [];
    if (turmasIds.length) {
      const [rows] = await db.query(
        `SELECT a.id, a.nome, m.id as matricula_id, m.turma_id, t.nome as turma_nome
         FROM matriculas m JOIN alunos a ON m.aluno_id = a.id JOIN turmas t ON m.turma_id = t.id
         WHERE m.status = 'ativa' AND m.turma_id IN (?)
         ORDER BY a.nome`,
        [turmasIds]
      );
      alunos = rows;
    }
    const resumo = [];
    for (const a of atrib) {
      const [notas] = await db.query(
        `SELECT n.periodo, n.nota, m.id as matricula_id FROM matriculas m
         LEFT JOIN notas n ON n.matricula_id = m.id AND n.disciplina_id = ?
         WHERE m.turma_id = ? AND m.status = 'ativa'`,
        [a.disciplina_id, a.turma_id]
      );
      const alunosTurma = alunos.filter((x) => Number(x.turma_id) === Number(a.turma_id));
      let comNota = 0;
      let semNota = 0;
      for (const al of alunosTurma) {
        const tem = notas.some((n) => n.matricula_id === al.matricula_id && n.nota != null);
        if (tem) comNota++;
        else semNota++;
      }
      const [faltas] = await db.query(
        `SELECT COUNT(*) as total FROM faltas f
         JOIN matriculas m ON f.matricula_id = m.id
         WHERE f.disciplina_id = ? AND m.turma_id = ?`,
        [a.disciplina_id, a.turma_id]
      );
      resumo.push({
        ...a,
        total_alunos: alunosTurma.length,
        com_notas: comNota,
        sem_notas: semNota,
        total_faltas: faltas[0]?.total || 0,
      });
    }
    return res.json({
      total_turmas: turmasIds.length,
      total_disciplinas: atrib.length,
      total_alunos: alunos.length,
      disciplinas: resumo,
      alunos,
    });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ disciplinas: [], alunos: [] });
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  uploadMaterial,
  uploadPlano,
  listarMateriaisProfessor,
  enviarMaterial,
  listarMateriaisRecebidos,
  enviarPlanoCurricular,
  listarPlanosCurriculares,
  professorPainelResumo,
};