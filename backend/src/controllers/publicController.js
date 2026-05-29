const bcrypt = require('bcryptjs');
const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = process.env.UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const classeNumeroDaSerie = (nome) => {
  if (!nome) return null;
  const lower = String(nome).toLowerCase();
  if (lower.includes('pré') || lower.includes('pre') || lower.includes('maternal') || lower.includes('jardim')) return 0;
  const m = lower.match(/(\d{1,2})\s*[ªº]?\s*(classe|ano)/);
  if (m) return parseInt(m[1], 10);
  return null;
};

// Inscrição pública do aluno:
// - cria usuário do aluno (senha = BI)
// - cria registro do aluno
// - cria inscrição pendente
// - deixa o usuário INATIVO até aprovação do admin
const inscreverAluno = async (req, res) => {
  const {
    primeiro_nome,
    ultimo_nome,
    bi,
    data_nascimento,
    nacionalidade,
    nome_mae,
    nome_pai,
    telefone_emergencia,
    nome_encarregado,
    serie_id,
    ano_letivo
  } = req.body;

  // Validação básica
  if (!primeiro_nome || !ultimo_nome || !bi || !data_nascimento || !serie_id || !ano_letivo) {
    return res.status(400).json({ message: 'Preencha nome, BI, data de nascimento, classe e ano letivo.' });
  }

  // Validar data
  const data = new Date(data_nascimento);
  if (isNaN(data.getTime())) {
    return res.status(400).json({ message: 'Data de nascimento inválida (use YYYY-MM-DD).' });
  }

  // Validar ano letivo
  const anoNum = parseInt(ano_letivo);
  if (isNaN(anoNum) || anoNum < 2024 || anoNum > 2099) {
    return res.status(400).json({ message: 'Ano letivo deve estar entre 2024 e 2099.' });
  }

  const nomeCompleto = `${String(primeiro_nome).trim()} ${String(ultimo_nome).trim()}`.trim();
  const biLimpo = String(bi).trim();

  // ✅ PEGAR CONEXÃO PARA TRANSAÇÃO
  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction(); // INICIAR TRANSAÇÃO

    // Evitar duplicações (BI já usado)
    const [exists] = await conn.query('SELECT id FROM usuarios WHERE cpf = ? LIMIT 1', [biLimpo]);
    if (exists.length > 0) {
      await conn.rollback();
      conn.release();
      return res.status(409).json({ message: 'Já existe uma inscrição/conta com este BI.' });
    }

    // Gerar e-mail único interno
    let emailInterno = `${biLimpo}@aluno.local`;
    const [emailExists] = await conn.query('SELECT id FROM usuarios WHERE email = ? LIMIT 1', [emailInterno]);
    if (emailExists.length > 0) {
      const unique = Date.now();
      emailInterno = `${biLimpo}-${unique}@aluno.local`;
    }

    const hash = await bcrypt.hash(biLimpo, 10);

    // ✅ CORRIGIDO: role = 'aluno' (não 'user')
    const [userResult] = await conn.query(
      'INSERT INTO usuarios (nome, email, senha, cpf, ativo, role) VALUES (?,?,?,?,?,?)',
      [nomeCompleto, emailInterno, hash, biLimpo, 0, 'aluno']
    );

    const usuario_id = userResult.insertId;

    // Determinar classe (nº) a partir do nome da série
    const [serieRows] = await conn.query('SELECT nome FROM series WHERE id = ? AND ativo = 1', [serie_id]);
    if (serieRows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ message: 'Classe (série) não existe ou está inativa.' });
    }

    const classeNumero = classeNumeroDaSerie(serieRows[0].nome);
    const precisaBoletim = typeof classeNumero === 'number' && classeNumero >= 2;

    // Encarregado obrigatório a partir da 2ª classe
    if (precisaBoletim && !nome_encarregado) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ message: 'Informe o nome do encarregado.' });
    }

    const responsavelEncarregado = precisaBoletim ? String(nome_encarregado).trim() : null;

    // Validar arquivos
    const biArquivo = req.files?.bi_arquivo?.[0];
    const historicoArquivo = req.files?.historico_arquivo?.[0];

    if (!biArquivo) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ message: 'Envie a cópia/foto do BI (bilhete de identidade).' });
    }
    if (precisaBoletim && !historicoArquivo) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ message: 'Envie o certificado/boletim de notas da classe anterior.' });
    }

    // Criar registro do aluno
    const [alunoResult] = await conn.query(
      `INSERT INTO alunos (usuario_id, nome, data_nascimento, cpf, sexo, nacionalidade, nome_mae, nome_pai, responsavel, telefone_emergencia)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        usuario_id,
        nomeCompleto,
        data_nascimento,
        biLimpo,
        null,
        nacionalidade || null,
        nome_mae || null,
        nome_pai || null,
        responsavelEncarregado,
        telefone_emergencia || null
      ]
    );

    const aluno_id = alunoResult.insertId;

    // Verificar vagas
    const [serie] = await conn.query('SELECT vagas_disponiveis FROM series WHERE id = ? AND ativo = 1', [serie_id]);
    if (serie.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ message: 'Classe inválida.' });
    }
    if (serie[0].vagas_disponiveis <= 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ message: 'Não há vagas disponíveis nesta classe.' });
    }

    // Criar inscrição
    const [insc] = await conn.query(
      'INSERT INTO inscricoes (usuario_id, aluno_id, serie_id, ano_letivo, status) VALUES (?,?,?,?,?)',
      [usuario_id, aluno_id, serie_id, anoNum, 'pendente']
    );

    // Guardar documentos enviados na inscrição pública
    await conn.query(
      'INSERT INTO documentos (inscricao_id, tipo, nome_arquivo, caminho_arquivo) VALUES (?,?,?,?)',
      [insc.insertId, 'rg', biArquivo.originalname, biArquivo.filename]
    );

    if (precisaBoletim && historicoArquivo) {
      await conn.query(
        'INSERT INTO documentos (inscricao_id, tipo, nome_arquivo, caminho_arquivo) VALUES (?,?,?,?)',
        [insc.insertId, 'historico_escolar', historicoArquivo.originalname, historicoArquivo.filename]
      );
    }

    // Criar notificação
    await conn.query(
      'INSERT INTO notificacoes (usuario_id, titulo, mensagem) VALUES (?,?,?)',
      [
        usuario_id,
        'Inscrição Recebida',
        'Sua inscrição foi recebida. Aguarde a aprovação/matrícula do colégio para acessar o portal.'
      ]
    );

    // ✅ SUCESSO - CONFIRMAR TRANSAÇÃO
    await conn.commit();
    conn.release();

    return res.status(201).json({
      message: 'Inscrição enviada com sucesso! Aguarde a aprovação para acessar o portal.',
      inscricao_id: insc.insertId
    });

  } catch (err) {
    // ❌ ERRO - DESFAZER TUDO
    if (conn) {
      try {
        await conn.rollback();
      } catch (rollbackErr) {
        console.error('Erro ao fazer rollback:', rollbackErr.message);
      }
      conn.release();
    }

    console.error('ERRO INSCRIÇÃO DETALHADO:', {
      message: err.message,
      code: err.code,
      sqlState: err.sqlState,
      sql: err.sql,
      stack: err.stack
    });

    // Retornar erro apropriado baseado no tipo
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Dados duplicados. Verifique BI ou email.' });
    }

    if (err.code === 'ER_BAD_FIELD_ERROR' || err.code === 'ER_NO_REFERENCED_ROW') {
      return res.status(400).json({ message: 'Dados inválidos. Verifique os campos preenchidos.' });
    }

    return res.status(500).json({ 
      message: 'Erro ao enviar inscrição. Verifique os dados e tente novamente.' 
    });
  }
};

module.exports = { inscreverAluno, uploadPublicInscricao: upload };