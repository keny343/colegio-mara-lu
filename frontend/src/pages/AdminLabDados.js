import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Database, Play, ShieldCheck, Gauge, Download } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import { Button, Card, Select, Input, FormField, LoadingState } from '../components/ui';
import './AdminLabDados.css';

const ALL_DESTS = [
  { id: 'jsonl', label: 'JSON Lines' },
  { id: 'csv', label: 'CSV' },
  { id: 'avro', label: 'Avro' },
  { id: 'parquet', label: 'Parquet' },
  { id: 'sql', label: 'SQL (MySQL + scripts .sql)' },
];

const PRESETS = [
  { id: '1000', label: 'Smoke — 1 000', records: 1000 },
  { id: '5000', label: 'Demo — 5 000', records: 5000 },
  { id: '10000', label: 'Demo+ — 10 000', records: 10000 },
  { id: '25000', label: 'Máx. painel — 25 000', records: 25000 },
];

function fmtBytes(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  if (v < 1024) return `${v} B`;
  if (v < 1024 ** 2) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / 1024 ** 2).toFixed(2)} MB`;
}

function fmtSec(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `${Number(n).toFixed(3)} s`;
}

const baseName = (p) => (typeof p === 'string' ? p.split(/[/\\]/).pop() : p);

/** Com responseType 'blob' o corpo do erro vem como Blob: lê a mensagem real do servidor. */
async function mensagemDeErro(e, padrao) {
  const data = e?.response?.data;
  if (data instanceof Blob) {
    try {
      const j = JSON.parse(await data.text());
      if (j?.message) return j.message;
    } catch (_) { /* não era JSON */ }
  } else if (data?.message) {
    return data.message;
  }
  return padrao;
}

export default function AdminLabDados() {
  const { error: notifyError, success: notifySuccess } = useNotification();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [status, setStatus] = useState(null);
  const [preset, setPreset] = useState('1000');
  const [seed, setSeed] = useState(42);
  const [batchSize, setBatchSize] = useState(2000);
  const [repeats, setRepeats] = useState(5);
  const [dests, setDests] = useState(() => new Set(ALL_DESTS.map((d) => d.id)));
  const [lastGenerate, setLastGenerate] = useState(null);
  const [lastValidate, setLastValidate] = useState(null);
  const [lastBench, setLastBench] = useState(null);

  const loadStatus = useCallback(async () => {
    const res = await api.get('/admin/lab/status');
    setStatus(res.data);
    if (res.data?.latest?.benchmark) setLastBench(res.data.latest.benchmark);
    else if (res.data?.latest?.writes) setLastGenerate(res.data.latest);
    return res.data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadStatus();
      } catch (e) {
        if (!cancelled) notifyError(e.response?.data?.message || 'Não foi possível carregar o laboratório.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadStatus, notifyError]);

  const records = useMemo(
    () => PRESETS.find((p) => p.id === preset)?.records || 1000,
    [preset],
  );

  const destList = useMemo(() => [...dests].join(','), [dests]);

  const toggleDest = (id) => {
    setDests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return prev;
        next.delete(id);
      } else next.add(id);
      return next;
    });
  };

  const payload = () => ({
    records,
    seed: Number(seed) || 42,
    batch_size: Number(batchSize) || 2000,
    destinations: destList,
  });

  const runGenerate = async () => {
    setBusy('generate');
    try {
      const res = await api.post('/admin/lab/generate', payload());
      setLastGenerate(res.data);
      setLastValidate(null);
      notifySuccess(`Geradas ${res.data.records} notas em ${fmtSec(res.data.elapsed_seconds)}.`);
      await loadStatus();
    } catch (e) {
      notifyError(e.response?.data?.message || 'Falha na geração.');
    } finally {
      setBusy(null);
    }
  };

  const runValidate = async () => {
    const out = lastGenerate?.out_dir || status?.latest?.out_dir;
    if (!out) {
      notifyError('Gere dados primeiro.');
      return;
    }
    setBusy('validate');
    try {
      const res = await api.post('/admin/lab/validate', { out_dir: out });
      setLastValidate(res.data);
      notifySuccess(res.data.equivalent ? 'Todos os destinos têm exactamente o mesmo conteúdo.' : 'Diferenças detectadas — veja o relatório.');
      await loadStatus();
    } catch (e) {
      notifyError(e.response?.data?.message || 'Falha na validação.');
    } finally {
      setBusy(null);
    }
  };

  const runBenchmark = async () => {
    setBusy('benchmark');
    try {
      const res = await api.post('/admin/lab/benchmark', { ...payload(), repeats: Number(repeats) || 5 });
      setLastBench(res.data);
      setLastGenerate((prev) => ({ ...(prev || {}), out_dir: res.data.out_dir, records: res.data.records }));
      notifySuccess('Benchmark concluído.');
      await loadStatus();
    } catch (e) {
      notifyError(e.response?.data?.message || 'Falha no benchmark.');
    } finally {
      setBusy(null);
    }
  };

  const chartData = useMemo(() => {
    const formats = lastBench?.formats || lastGenerate?.writes;
    if (!formats) return [];
    return Object.entries(formats).map(([name, m]) => ({
      formato: name.toUpperCase(),
      bytes: m.bytes ?? 0,
      write_s: m.write_seconds?.median ?? m.write_seconds ?? 0,
    }));
  }, [lastBench, lastGenerate]);

  const download = async (file) => {
    const out = lastGenerate?.out_dir || lastBench?.out_dir || status?.latest?.out_dir;
    if (!out || !file) return;
    try {
      const res = await api.get(`/admin/lab/download/${out}/${file}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      notifyError(await mensagemDeErro(e, 'Download indisponível.'));
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div className="lab-page">
      <header className="page-header">
        <div>
          <p className="lab-eyebrow"><Database size={14} /> Engenharia de armazenamento</p>
          <h2 className="page-header-title">Laboratório de dados</h2>
          <p className="page-header-sub">
            Notas de alunos do Colégio Mara e Lu (3 trimestres: 1PP · 1PT · 2PP · 2PT · 3PP · 3PT; escala 0–10 até à 6ª classe e 0–20 da 7ª à 13ª).
            Gerar, gravar, validar e comparar JSONL · CSV · Avro · Parquet · SQL.
            Máximo no painel: {status?.max_records?.toLocaleString('pt-PT') || '25 000'} registos.
            Escalas S/M via CLI Python em <code>data-engineering/</code>.
          </p>
        </div>
      </header>

      <Card className="lab-card">
        <h3 className="lab-card-title">Parâmetros</h3>
        <div className="lab-grid">
          <FormField label="Volume (notas)">
            <Select value={preset} onChange={(e) => setPreset(e.target.value)} disabled={!!busy}>
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Seed">
            <Input type="number" value={seed} onChange={(e) => setSeed(e.target.value)} disabled={!!busy} />
          </FormField>
          <FormField label="Tamanho do lote">
            <Input type="number" value={batchSize} onChange={(e) => setBatchSize(e.target.value)} disabled={!!busy} />
          </FormField>
          <FormField label="Repetições (benchmark, 1.ª = cold)">
            <Input type="number" min="2" max="10" value={repeats} onChange={(e) => setRepeats(e.target.value)} disabled={!!busy} />
          </FormField>
        </div>
        <fieldset className="lab-dests" disabled={!!busy}>
          <legend>Destinos</legend>
          {ALL_DESTS.map((d) => (
            <label key={d.id} className="lab-check">
              <input
                type="checkbox"
                checked={dests.has(d.id)}
                onChange={() => toggleDest(d.id)}
              />
              {d.label}
            </label>
          ))}
        </fieldset>
        <div className="lab-actions">
          <Button variant="primary" icon={<Play size={16} />} loading={busy === 'generate'} disabled={!!busy} onClick={runGenerate}>
            Gerar e gravar
          </Button>
          <Button variant="secondary" icon={<ShieldCheck size={16} />} loading={busy === 'validate'} disabled={!!busy} onClick={runValidate}>
            Validar equivalência
          </Button>
          <Button variant="secondary" icon={<Gauge size={16} />} loading={busy === 'benchmark'} disabled={!!busy} onClick={runBenchmark}>
            Benchmark
          </Button>
        </div>
      </Card>

      {lastGenerate && (
        <Card className="lab-card">
          <h3 className="lab-card-title">Última geração — {lastGenerate.out_dir}</h3>
          <p className="lab-meta">
            {lastGenerate.records?.toLocaleString('pt-PT')} notas · seed {lastGenerate.seed} · {fmtSec(lastGenerate.elapsed_seconds)}
          </p>
          <div className="lab-table-wrap">
            <table className="lab-table">
              <thead>
                <tr>
                  <th>Destino</th>
                  <th>Registos</th>
                  <th>Tamanho</th>
                  <th>Escrita</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(lastGenerate.writes || {}).map(([name, w]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>{w.records?.toLocaleString('pt-PT') ?? '—'}</td>
                    <td>{fmtBytes(w.bytes)}</td>
                    <td>{fmtSec(w.write_seconds)}</td>
                    <td>
                      {name !== 'sql' && w.path && (
                        <button type="button" className="lab-dl" onClick={() => download(baseName(w.path))}>
                          <Download size={14} /> Descarregar
                        </button>
                      )}
                      {name === 'sql' && (
                        <>
                          {w.path && (
                            <button type="button" className="lab-dl" onClick={() => download(baseName(w.path))}>
                              <Download size={14} /> SQL — criar
                            </button>
                          )}
                          {' '}
                          {w.drop_path && (
                            <button type="button" className="lab-dl" onClick={() => download(baseName(w.drop_path))}>
                              <Download size={14} /> SQL — eliminar
                            </button>
                          )}
                          <div>
                            <span className="lab-sql-tag">
                              {w.db_loaded === false
                                ? `MySQL: não carregado (${w.db_error || 'erro'}) — scripts disponíveis`
                                : `MySQL · ${(w.tables || ['lab_alunos', 'lab_notas']).join(', ')}`}
                            </span>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {lastValidate && (
        <Card className="lab-card">
          <h3 className="lab-card-title">Validação</h3>
          <p className={`lab-eq ${lastValidate.equivalent ? 'ok' : 'bad'}`}>
            {lastValidate.equivalent
              ? `Equivalência confirmada: o conteúdo completo de cada registo é idêntico em todos os destinos (referência: ${lastValidate.referencia}).`
              : 'Equivalência falhou — veja as diferenças abaixo.'}
          </p>
          {lastValidate.regras_negocio && (
            <p className={`lab-eq ${lastValidate.regras_negocio.ok ? 'ok' : 'bad'}`}>
              Regras do sistema (escala, nota mínima, situação, períodos):
              {' '}
              {lastValidate.regras_negocio.ok
                ? `${lastValidate.regras_negocio.registos_verificados} registos cumprem todas as regras.`
                : 'há violações.'}
            </p>
          )}
          {lastValidate.diferencas && Object.keys(lastValidate.diferencas).length > 0 && (
            <pre className="lab-pre">{JSON.stringify(lastValidate.diferencas, null, 2)}</pre>
          )}
          <pre className="lab-pre">{JSON.stringify(lastValidate.fingerprints, null, 2)}</pre>
        </Card>
      )}

      {lastBench?.formats && (
        <Card className="lab-card">
          <h3 className="lab-card-title">Benchmark — medianas (mín–máx), {lastBench.repeats?.warm_stats ?? '—'} repetições quentes</h3>
          <p className="lab-meta">
            1.ª repetição (cold) fora das estatísticas · {lastBench.ambiente?.cpu_nucleos ?? '?'} núcleos · {lastBench.ambiente?.ram_gb ?? '?'} GB RAM · Node {lastBench.ambiente?.node} · MySQL {lastBench.ambiente?.mysql || '—'}
          </p>
          <div className="lab-table-wrap">
            <table className="lab-table">
              <thead>
                <tr>
                  <th>Formato</th>
                  <th>Escrita</th>
                  <th>Leitura total</th>
                  <th>GROUP BY disciplina</th>
                  <th>Só coluna nota</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(lastBench.formats).map(([name, m]) => {
                  const cel = (s) => (s?.median == null ? '—' : `${fmtSec(s.median)} (${fmtSec(s.min)}–${fmtSec(s.max)})`);
                  return (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>{cel(m.write_seconds)}</td>
                      <td>{cel(m.read_seconds)}</td>
                      <td>{name === 'sql' && m.group_by_seconds_engine ? `${cel(m.group_by_seconds_engine)} · motor` : cel(m.group_by_seconds)}</td>
                      <td>{name === 'sql' && m.column_read_seconds_engine ? `${cel(m.column_read_seconds_engine)} · motor` : cel(m.column_read_seconds)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {chartData.length > 0 && (
        <Card className="lab-card">
          <h3 className="lab-card-title">Comparativo</h3>
          <div className="lab-charts">
            <div className="lab-chart">
              <h4>Tamanho em disco</h4>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" />
                  <XAxis dataKey="formato" tick={{ fill: 'var(--castanho-medio)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'var(--castanho-medio)', fontSize: 12 }} />
                  <Tooltip formatter={(v) => fmtBytes(v)} />
                  <Bar dataKey="bytes" name="Bytes" fill="var(--laranja)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="lab-chart">
              <h4>Tempo de escrita</h4>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" />
                  <XAxis dataKey="formato" tick={{ fill: 'var(--castanho-medio)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'var(--castanho-medio)', fontSize: 12 }} />
                  <Tooltip formatter={(v) => fmtSec(v)} />
                  <Legend />
                  <Bar dataKey="write_s" name="Segundos" fill="var(--castanho-medio)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      )}

      {status?.runs?.length > 0 && (
        <Card className="lab-card">
          <h3 className="lab-card-title">Histórico recente</h3>
          <ul className="lab-runs">
            {status.runs.map((r) => (
              <li key={r.out_dir}>
                <strong>{r.out_dir}</strong>
                <span>{r.records?.toLocaleString('pt-PT')} · seed {r.seed} · {r.created_at ? new Date(r.created_at).toLocaleString('pt-PT') : '—'}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}