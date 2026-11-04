import React, { useCallback, useMemo, useState } from 'react';
import { BarChart3, BookOpen, Download, Printer, School, TrendingUp, Users } from 'lucide-react';
import { Button, DataTable, FormField, Select } from '../components/ui';
import { useFetch } from '../hooks/useFetch';
import api from '../services/api';
import { baixarCsv } from '../utils/relatoriosCsv';
import './Relatorios.css';

const PERIODOS = [
  { key: '1PP', label: '1.ª Parcial' },
  { key: '1PT', label: '1.º Trimestre' },
  { key: '2PP', label: '2.ª Parcial' },
  { key: '2PT', label: '2.º Trimestre' },
  { key: '3PP', label: '3.ª Parcial' },
  { key: '3PT', label: '3.º Trimestre' },
];

const ESTADOS_MATRICULA = {
  ativa: 'Ativa',
  transferida: 'Transferida',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

const COLUNAS_MATRICULAS = [
  {
    key: 'aluno_nome',
    label: 'Aluno',
    sortable: true,
    render: (aluno) => <strong className="relatorios-cell-primary">{aluno.aluno_nome}</strong>,
  },
  {
    key: 'turma_nome',
    label: 'Turma',
    sortable: true,
    render: (aluno) => (
      <div className="relatorios-cell-stack">
        <strong>{aluno.turma_nome || '—'}</strong>
        <span>
          {aluno.serie_classe != null ? `${aluno.serie_classe}.ª classe` : 'Classe não indicada'}
          {aluno.curso_nome ? ` · ${aluno.curso_nome}` : ''}
        </span>
      </div>
    ),
  },
  {
    key: 'matricula_status',
    label: 'Situação',
    sortable: true,
    render: (aluno) => (
      <span className="relatorios-status">
        {ESTADOS_MATRICULA[aluno.matricula_status] || aluno.matricula_status || '—'}
      </span>
    ),
  },
  {
    key: 'data_matricula',
    label: 'Data da matrícula',
    sortable: true,
    sortValue: (aluno) => (aluno.data_matricula ? new Date(aluno.data_matricula).getTime() : 0),
    render: (aluno) => formatarData(aluno.data_matricula),
  },
  {
    key: 'total_disciplinas_com_notas',
    label: 'Disciplinas com notas',
    sortable: true,
    sortValue: (aluno) => aluno.total_disciplinas_com_notas,
    render: (aluno) => `${aluno.total_disciplinas_com_notas} / ${aluno.total_disciplinas}`,
  },
  {
    key: 'media_geral',
    label: 'Média geral',
    sortable: true,
    sortValue: (aluno) => (aluno.media_geral == null ? -1 : Number(aluno.media_geral)),
    render: (aluno) => formatarNota(aluno.media_geral),
  },
];

const COLUNAS_NOTAS = [
  {
    key: 'aluno_nome',
    label: 'Aluno / turma',
    sortable: true,
    render: (linha) => (
      <div className="relatorios-cell-stack">
        <strong>{linha.aluno.aluno_nome}</strong>
        <span>{linha.aluno.turma_nome || 'Turma não indicada'}</span>
      </div>
    ),
  },
  {
    key: 'disciplina_nome',
    label: 'Disciplina',
    sortable: true,
    render: (linha) => linha.disciplina?.disciplina_nome || 'Sem disciplina atribuída',
  },
  ...PERIODOS.map(({ key, label }) => ({
    key: `nota_${key}`,
    label,
    sortable: true,
    render: (linha) => formatarNota(linha[`nota_${key}`]),
  })),
  {
    key: 'media_disciplina',
    label: 'Média',
    sortable: true,
    sortValue: (linha) => (linha.media_disciplina == null ? -1 : Number(linha.media_disciplina)),
    render: (linha) => formatarNota(linha.media_disciplina),
  },
];

function formatarNota(valor) {
  if (valor == null || valor === '') return '—';
  const numero = Number(valor);
  return Number.isFinite(numero)
    ? numero.toLocaleString('pt-AO', { maximumFractionDigits: 1 })
    : '—';
}

function formatarData(valor) {
  if (!valor) return '—';
  const parteData = String(valor).slice(0, 10);
  const correspondencia = parteData.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (correspondencia) return `${correspondencia[3]}/${correspondencia[2]}/${correspondencia[1]}`;

  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? '—' : data.toLocaleDateString('pt-AO');
}

function normalizarPesquisa(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt');
}

function obterLinhaNotas(alunos) {
  return alunos.flatMap((aluno) => {
    const disciplinas = aluno.disciplinas.length ? aluno.disciplinas : [null];
    return disciplinas.map((disciplina) => ({
      rowKey: `${aluno.matricula_id}-${disciplina?.disciplina_id ?? 'sem-disciplina'}`,
      aluno,
      disciplina,
      aluno_nome: aluno.aluno_nome,
      disciplina_nome: disciplina?.disciplina_nome || '',
      media_disciplina: disciplina?.media ?? null,
      ...Object.fromEntries(
        PERIODOS.map(({ key }) => [`nota_${key}`, disciplina?.periodos?.[key] ?? null])
      ),
    }));
  });
}

export default function Relatorios() {
  const [anoLetivo, setAnoLetivo] = useState('');
  const [estadoMatricula, setEstadoMatricula] = useState('ativa');
  const [turmaId, setTurmaId] = useState('');
  const [pesquisa, setPesquisa] = useState('');
  const [tipoRelatorio, setTipoRelatorio] = useState('matriculas');

  const buscarRelatorio = useCallback(
    (signal) =>
      api.get('/staff/relatorios/alunos', {
        params: {
          status: estadoMatricula,
          ...(anoLetivo ? { ano_letivo: anoLetivo } : {}),
        },
        signal,
      }),
    [anoLetivo, estadoMatricula]
  );
  const { data: relatorio, loading, error, refetch } = useFetch(buscarRelatorio, [buscarRelatorio]);

  const alunos = useMemo(
    () => (Array.isArray(relatorio?.alunos) ? relatorio.alunos : []),
    [relatorio?.alunos]
  );
  const anosLetivos = relatorio?.anos_letivos?.length
    ? relatorio.anos_letivos.map(String)
    : [String(relatorio?.ano_letivo || new Date().getFullYear())];
  const anoSelecionado = anoLetivo || String(relatorio?.ano_letivo || anosLetivos[0]);

  const turmas = useMemo(() => {
    const mapa = new Map();
    for (const aluno of alunos) {
      const id = String(aluno.turma_id);
      if (!mapa.has(id)) mapa.set(id, { id, nome: aluno.turma_nome || 'Turma sem nome' });
    }
    return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { numeric: true }));
  }, [alunos]);

  const alunosFiltrados = useMemo(() => {
    const termo = normalizarPesquisa(pesquisa);
    return alunos.filter((aluno) => {
      const pertenceTurma = !turmaId || String(aluno.turma_id) === turmaId;
      const textoAluno = normalizarPesquisa(
        [aluno.aluno_nome, aluno.turma_nome, aluno.curso_nome, aluno.serie_classe].join(' ')
      );
      return pertenceTurma && (!termo || textoAluno.includes(termo));
    });
  }, [alunos, pesquisa, turmaId]);

  const linhasNotas = useMemo(() => obterLinhaNotas(alunosFiltrados), [alunosFiltrados]);
  const linhasAtuais = tipoRelatorio === 'notas' ? linhasNotas : alunosFiltrados;
  const mediasGerais = alunosFiltrados
    .map((aluno) => (aluno.media_geral == null ? null : Number(aluno.media_geral)))
    .filter((media) => Number.isFinite(media));
  const mediaGeral = mediasGerais.length
    ? mediasGerais.reduce((total, media) => total + media, 0) / mediasGerais.length
    : null;
  const totalNotasLancadas = alunosFiltrados.reduce(
    (total, aluno) => total + (Number(aluno.total_notas_lancadas) || 0),
    0
  );

  const estatisticas = [
    { label: 'Alunos no relatório', valor: alunosFiltrados.length, icon: Users },
    { label: 'Turmas', valor: new Set(alunosFiltrados.map((aluno) => aluno.turma_id)).size, icon: School },
    { label: 'Notas lançadas', valor: totalNotasLancadas, icon: BookOpen },
    { label: 'Média geral', valor: formatarNota(mediaGeral), icon: TrendingUp },
  ];

  const tituloRelatorio = tipoRelatorio === 'matriculas' ? 'Alunos matriculados' : 'Notas por disciplina';
  const estadoSelecionado = ESTADOS_MATRICULA[estadoMatricula] || 'Todas as situações';

  function exportarCsv() {
    if (tipoRelatorio === 'matriculas') {
      const cabecalhos = [
        'Aluno',
        'Turma',
        'Classe',
        'Curso',
        'Ano letivo',
        'Situação da matrícula',
        'Data da matrícula',
        'Disciplinas',
        'Disciplinas com notas',
        'Notas lançadas',
        'Média geral',
      ];
      const linhas = alunosFiltrados.map((aluno) => [
        aluno.aluno_nome,
        aluno.turma_nome,
        aluno.serie_classe,
        aluno.curso_nome,
        aluno.ano_letivo,
        ESTADOS_MATRICULA[aluno.matricula_status] || aluno.matricula_status,
        formatarData(aluno.data_matricula),
        aluno.total_disciplinas,
        aluno.total_disciplinas_com_notas,
        aluno.total_notas_lancadas,
        aluno.media_geral == null ? '' : formatarNota(aluno.media_geral),
      ]);
      baixarCsv(`relatorio-matriculas-${anoSelecionado}.csv`, cabecalhos, linhas);
      return;
    }

    const cabecalhos = [
      'Aluno',
      'Turma',
      'Classe',
      'Curso',
      'Ano letivo',
      'Situação da matrícula',
      'Disciplina',
      ...PERIODOS.map(({ label }) => label),
      'Média da disciplina',
    ];
    const linhas = linhasNotas.map((linha) => [
      linha.aluno.aluno_nome,
      linha.aluno.turma_nome,
      linha.aluno.serie_classe,
      linha.aluno.curso_nome,
      linha.aluno.ano_letivo,
      ESTADOS_MATRICULA[linha.aluno.matricula_status] || linha.aluno.matricula_status,
      linha.disciplina?.disciplina_nome || 'Sem disciplina atribuída',
      ...PERIODOS.map(({ key }) => {
        const nota = linha.disciplina?.periodos?.[key];
        return nota == null ? '' : formatarNota(nota);
      }),
      linha.media_disciplina == null ? '' : formatarNota(linha.media_disciplina),
    ]);
    baixarCsv(`relatorio-notas-${anoSelecionado}.csv`, cabecalhos, linhas);
  }

  return (
    <div className="relatorios-page">
      <header className="page-header relatorios-header">
        <div className="relatorios-header-copy">
          <h2 className="page-header-title">
            <BarChart3 className="page-header-icon" size={22} aria-hidden="true" />
            Relatórios escolares
          </h2>
          <p className="page-header-sub">
            Consulte matrículas e notas por ano letivo e descarregue os dados para partilhar ou arquivar.
          </p>
        </div>
        <div className="relatorios-export no-print">
          <div className="relatorios-export-actions">
            <Button
              variant="outline"
              size="sm"
              icon={<Download size={16} aria-hidden="true" />}
              onClick={exportarCsv}
              disabled={loading || linhasAtuais.length === 0}
            >
              Descarregar CSV
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Printer size={16} aria-hidden="true" />}
              onClick={() => window.print()}
              disabled={loading || linhasAtuais.length === 0}
            >
              Imprimir / PDF
            </Button>
          </div>
          <p className="relatorios-export-note">No diálogo de impressão, escolha “Guardar como PDF”.</p>
        </div>
      </header>

      <section className="relatorios-print-meta" aria-hidden="true">
        <h1>Colégio Mara &amp; Lu · Relatório académico</h1>
        <p>
          {tituloRelatorio} · Ano letivo {anoSelecionado} · {estadoSelecionado}
        </p>
      </section>

      <section className="relatorios-summary" aria-label="Resumo do relatório">
        {estatisticas.map(({ label, valor, icon: Icon }) => (
          <article className="relatorios-stat" key={label}>
            <span className="relatorios-stat-icon" aria-hidden="true"><Icon size={18} /></span>
            <div>
              <p className="relatorios-stat-label">{label}</p>
              <p className="relatorios-stat-value">{valor}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="relatorios-filters no-print" aria-label="Filtros do relatório">
        <div className="relatorios-filter-grid">
          <FormField label="Ano letivo" htmlFor="relatorio-ano">
            <Select
              id="relatorio-ano"
              value={anoSelecionado}
              onChange={(event) => {
                setAnoLetivo(event.target.value);
                setTurmaId('');
              }}
            >
              {anosLetivos.map((ano) => <option key={ano} value={ano}>{ano}</option>)}
            </Select>
          </FormField>
          <FormField label="Situação da matrícula" htmlFor="relatorio-situacao">
            <Select
              id="relatorio-situacao"
              value={estadoMatricula}
              onChange={(event) => {
                setEstadoMatricula(event.target.value);
                setTurmaId('');
              }}
            >
              <option value="ativa">Ativas</option>
              <option value="transferida">Transferidas</option>
              <option value="concluida">Concluídas</option>
              <option value="cancelada">Canceladas</option>
              <option value="todas">Todas as situações</option>
            </Select>
          </FormField>
          <FormField label="Turma" htmlFor="relatorio-turma">
            <Select id="relatorio-turma" value={turmaId} onChange={(event) => setTurmaId(event.target.value)}>
              <option value="">Todas as turmas</option>
              {turmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.nome}</option>)}
            </Select>
          </FormField>
          <FormField label="Pesquisar aluno ou turma" htmlFor="relatorio-pesquisa">
            <div className="relatorios-search">
              <input
                id="relatorio-pesquisa"
                className="form-control"
                type="search"
                value={pesquisa}
                onChange={(event) => setPesquisa(event.target.value)}
                placeholder="Nome, turma ou curso"
                autoComplete="off"
              />
            </div>
          </FormField>
        </div>
      </section>

      <section className="relatorios-results" aria-labelledby="relatorios-resultados-titulo">
        <div className="relatorios-tabs no-print" role="group" aria-label="Formato do relatório">
          <button
            type="button"
            className={`relatorios-tab${tipoRelatorio === 'matriculas' ? ' is-active' : ''}`}
            aria-pressed={tipoRelatorio === 'matriculas'}
            onClick={() => setTipoRelatorio('matriculas')}
          >
            Alunos matriculados <span>{alunosFiltrados.length}</span>
          </button>
          <button
            type="button"
            className={`relatorios-tab${tipoRelatorio === 'notas' ? ' is-active' : ''}`}
            aria-pressed={tipoRelatorio === 'notas'}
            onClick={() => setTipoRelatorio('notas')}
          >
            Notas por disciplina <span>{linhasNotas.length}</span>
          </button>
        </div>

        <div className="relatorios-results-heading">
          <div>
            <h3 id="relatorios-resultados-titulo">{tituloRelatorio}</h3>
            <p>
              Ano letivo {anoSelecionado} · {estadoSelecionado} · {linhasAtuais.length} registo(s)
            </p>
          </div>
        </div>

        <DataTable
          className="relatorios-table"
          columns={tipoRelatorio === 'notas' ? COLUNAS_NOTAS : COLUNAS_MATRICULAS}
          rows={linhasAtuais}
          keyField={tipoRelatorio === 'notas' ? 'rowKey' : 'matricula_id'}
          loading={loading}
          error={error}
          onRetry={refetch}
          emptyMessage={
            tipoRelatorio === 'notas'
              ? 'Não há notas ou disciplinas para os filtros selecionados.'
              : 'Não há alunos matriculados para os filtros selecionados.'
          }
        />
      </section>
    </div>
  );
}
