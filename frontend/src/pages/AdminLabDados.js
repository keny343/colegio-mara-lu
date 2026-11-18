import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Database, Play, ShieldCheck, Gauge, Download, Cpu, HardDrive } from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import { Button, Card, Select, Input, FormField, LoadingState } from '../components/ui';
import './AdminLabDados.css';

const ALL_DESTS = [
  { id: 'jsonl', label: 'JSON Lines' },
  { id: 'csv', label: 'CSV' },
  { id: 'avro', label: 'Avro' },
  { id: 'parquet', label: 'Parquet' },
  { id: 'sql', label: 'SQL (MySQL)' },
];

const BASE_PRESETS = [1000, 5000, 10000, 50000, 100000];
const POLL_MS = 4000; // o limitador da API é 300 pedidos / 15 min: não fazer polling mais rápido

function fmtBytes(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  if (v < 1024) return `${v} B`;
  if (v < 1024 ** 2) return `${(v / 1024).toFixed(1)} KB`;
  if (v < 1024 ** 3) return `${(v / 1024 ** 2).toFixed(2)} MB`;
  return `${(v / 1024 ** 3).toFixed(2)} GB`;
}

function fmtSec(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `${Number(n).toFixed(3)} s`;
}

function fmtMetric(metric) {
  if (!metric || typeof metric !== 'object') return '—';
  return `med ${Number(metric.median).toFixed(3)} · mín ${Number(metric.min).toFixed(3)} · máx ${Number(metric.max).toFixed(3)}`;
}

function fmtMb(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `${Number(n).toFixed(1)} MB`;
}

function basename(value) {
  return typeof value === 'string' ? value.split(/[/\\]/).pop() : value;
}

function DlButton({ file, label, onDownload }) {
  return (
    <button type="button" className="lab-dl" onClick={() => onDownload(file)}><Download size={14} /> {label}</button>
  );
}

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

export default function AdminLabDados() {
  const { error: notifyError, success: notifySuccess } = useNotification();
  const mounted = useRef(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [progress, setProgress] = useState(null);
  const [status, setStatus] = useState(null);
  const [records, setRecords] = useState(1000);
  const [seed, setSeed] = useState(42);
  const [batchSize, setBatchSize] = useState(1000);
  const [repeats, setRepeats] = useState(5);
  const [dests, setDests] = useState(() => new Set(ALL_DESTS.map((d) => d.id)));
  const [lastGenerate, setLastGenerate] = useState(null);
  const [lastValidate, setLastValidate] = useState(null);
  const [lastBench, setLastBench] = useState(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const loadStatus = useCallback(async () => {
    const res = await api.get('/admin/lab/status');
    setStatus(res.data);
    if (res.data?.latest?.benchmark) {
      setLastBench(res.data.latest.benchmark);
      if (res.data.latest.writes) setLastGenerate(res.data.latest);
    } else if (res.data?.latest?.writes) setLastGenerate(res.data.latest);
    return res.data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { await loadStatus(); }
      catch (e) { if (!cancelled) notifyError(e.response?.data?.message || 'Não foi possível carregar o laboratório.'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [loadStatus, notifyError]);

  // Se a página foi recarregada a meio de uma tarefa, acompanha o progresso pelo /status.
  const externalRunning = !!status?.running && !busy;
  useEffect(() => {
    if (!externalRunning) return undefined;
    const timer = setInterval(() => { loadStatus().catch(() => {}); }, POLL_MS);
    return () => clearInterval(timer);
  }, [externalRunning, loadStatus]);

  const maxRecords = status?.max_records || 100000;
  const presets = useMemo(() => {
    const list = BASE_PRESETS.filter((n) => n <= maxRecords);
    if (!list.includes(maxRecords)) list.push(maxRecords);
    return list;
  }, [maxRecords]);
  const destList = useMemo(() => [...dests].join(','), [dests]);

  const toggleDest = (id) => {
    setDests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size === 1) return prev; next.delete(id); }
      else next.add(id);
      return next;
    });
  };

  const payload = () => ({
    records: Number(records),
    seed: Number(seed) || 42,
    batch_size: Number(batchSize) || 1000,
    destinations: destList,
    repeats: Number(repeats) || 5,
  });

  /** Lança a tarefa (202 + job_id) e faz polling até terminar. Erros de rede passageiros não interrompem. */
  const runJob = async (kind, url, body) => {
    setBusy(kind);
    setProgress({ percent: 0, phase: 'a iniciar' });
    try {
      const { data } = await api.post(url, body);
      for (;;) {
        await sleep(POLL_MS);
        if (!mounted.current) return null;
        let job = null;
        try {
          job = (await api.get(`/admin/lab/jobs/${data.job_id}`)).data;
        } catch (e) {
          const code = e.response?.status;
          if (code === 404) throw new Error('A tarefa desapareceu (o servidor reiniciou?). Tente de novo.');
          if (code === 401 || code === 403) throw e;
          continue; // 429 / rede: tenta no próximo ciclo
        }
        setProgress({ percent: job.percent || 0, phase: job.phase || '' });
        if (job.status === 'done') return job.result;
        if (job.status === 'error') throw new Error(job.error || 'A tarefa falhou.');
      }
    } finally {
      if (mounted.current) { setBusy(null); setProgress(null); }
    }
  };

  const failMessage = (e, fallback) => e.response?.data?.message || e.message || fallback;

  const runGenerate = async () => {
    try {
      const result = await runJob('generate', '/admin/lab/generate', payload());
      if (!result) return;
      setLastGenerate(result);
      setLastValidate(null);
      notifySuccess(`Gerados ${result.records.toLocaleString('pt-PT')} registos em ${fmtSec(result.elapsed_seconds)}.`);
      await loadStatus();
    } catch (e) { notifyError(failMessage(e, 'Falha na geração.')); }
  };

  const runValidate = async () => {
    const out = lastGenerate?.out_dir || status?.latest?.out_dir;
    if (!out) { notifyError('Gere dados primeiro.'); return; }
    try {
      const result = await runJob('validate', '/admin/lab/validate', { out_dir: out, sample_size: 100 });
      if (!result) return;
      setLastValidate(result);
      notifySuccess(result.equivalent ? 'Destinos equivalentes.' : 'Validação com diferenças.');
    } catch (e) { notifyError(failMessage(e, 'Falha na validação.')); }
  };

  const runBenchmark = async () => {
    try {
      const result = await runJob('benchmark', '/admin/lab/benchmark', payload());
      if (!result) return;
      setLastBench(result);
      setLastGenerate({
        out_dir: result.out_dir, records: result.records, seed: result.seed, elapsed_seconds: result.elapsed_seconds, writes: result.writes || {},
      });
      notifySuccess(`Benchmark concluído com ${result.repeats} repetições.`);
      await loadStatus();
    } catch (e) { notifyError(failMessage(e, 'Falha no benchmark.')); }
  };

  /** Pede um link assinado (60 s, uso único) e deixa o browser descarregar em streaming. */
  const downloadFile = async (file) => {
    const out = lastGenerate?.out_dir || lastBench?.out_dir || status?.latest?.out_dir;
    if (!out || !file) return;
    try {
      const { data } = await api.post('/admin/lab/download-link', { out_dir: out, file });
      const base = String(api.defaults.baseURL || '/api').replace(/\/$/, '');
      window.location.assign(`${base}${data.url}`);
    } catch (e) { notifyError(failMessage(e, 'Não foi possível iniciar a descarga.')); }
  };

  const chartData = useMemo(() => {
    const formats = lastBench?.formats || lastGenerate?.writes;
    if (!formats) return [];
    return Object.entries(formats).map(([name, m]) => ({
      formato: name.toUpperCase(),
      bytes: m.bytes ?? 0,
      write_s: m.write_seconds?.median ?? m.write_seconds ?? 0,
      read_s: m.full_read_seconds?.median ?? 0,
      cpu_pct: m.cpu_percent_one_core?.median ?? 0,
      rss_mb: m.peak_rss_mb?.median ?? 0,
    }));
  }, [lastBench, lastGenerate]);

  if (loading) return <LoadingState />;

  const working = !!busy || !!status?.running;
  const shownProgress = progress || (status?.running ? { percent: status.current_job?.percent || 0, phase: status.current_job?.phase || 'em execução' } : null);

  return (
    <div className="lab-page">
      <header className="page-header">
        <div>
          <p className="lab-eyebrow"><Database size={14} /> Engenharia de armazenamento</p>
          <h2 className="page-header-title">Laboratório de dados</h2>
          <p className="page-header-sub">
            Gerar, gravar, validar e comparar JSONL · CSV · Avro · Parquet · SQL (MySQL).
            Máximo no painel: {maxRecords.toLocaleString('pt-PT')} alunos por execução.
            {status?.disk?.free_bytes != null && ` Disco livre: ${fmtBytes(status.disk.free_bytes)}.`}
          </p>
        </div>
      </header>

      <Card className="lab-card">
        <h3 className="lab-card-title">Parâmetros</h3>
        <div className="lab-grid">
          <FormField label="Volume (atalhos)">
            <Select value={presets.includes(Number(records)) ? String(records) : ''} onChange={(e) => e.target.value && setRecords(Number(e.target.value))} disabled={working}>
              <option value="">Personalizado</option>
              {presets.map((n) => <option key={n} value={n}>{n.toLocaleString('pt-PT')}</option>)}
            </Select>
          </FormField>
          <FormField label="Nº de alunos"><Input type="number" min="1" max={maxRecords} value={records} onChange={(e) => setRecords(e.target.value)} disabled={working} /></FormField>
          <FormField label="Seed"><Input type="number" value={seed} onChange={(e) => setSeed(e.target.value)} disabled={working} /></FormField>
          <FormField label="Tamanho do lote"><Input type="number" min="1" max={status?.max_batch || 20000} value={batchSize} onChange={(e) => setBatchSize(e.target.value)} disabled={working} /></FormField>
          <FormField label="Repetições (benchmark)"><Input type="number" min="1" max="10" value={repeats} onChange={(e) => setRepeats(e.target.value)} disabled={working} /></FormField>
        </div>
        <fieldset className="lab-dests" disabled={working}>
          <legend>Destinos</legend>
          {ALL_DESTS.map((d) => (
            <label key={d.id} className="lab-check"><input type="checkbox" checked={dests.has(d.id)} onChange={() => toggleDest(d.id)} />{d.label}</label>
          ))}
        </fieldset>
        <div className="lab-actions">
          <Button variant="primary" icon={<Play size={16} />} loading={busy === 'generate'} disabled={working} onClick={runGenerate}>Gerar e gravar</Button>
          <Button variant="secondary" icon={<ShieldCheck size={16} />} loading={busy === 'validate'} disabled={working} onClick={runValidate}>Validar equivalência</Button>
          <Button variant="secondary" icon={<Gauge size={16} />} loading={busy === 'benchmark'} disabled={working} onClick={runBenchmark}>{`Benchmark · ${Number(repeats) || 5} repetições`}</Button>
        </div>
        {shownProgress && (
          <div className="lab-progress" role="status" aria-live="polite" style={{ marginTop: 16 }}>
            <div style={{ height: 8, borderRadius: 4, background: 'rgba(0,0,0,0.12)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, shownProgress.percent)}%`, height: '100%', background: 'var(--laranja)', transition: 'width 0.4s' }} />
            </div>
            <p className="lab-meta" style={{ marginTop: 6 }}>{shownProgress.phase} · {Math.round(shownProgress.percent)} %</p>
          </div>
        )}
      </Card>

      {lastGenerate && (
        <Card className="lab-card">
          <h3 className="lab-card-title">Última execução — {lastGenerate.out_dir}</h3>
          <p className="lab-meta">{lastGenerate.records?.toLocaleString('pt-PT')} alunos · seed {lastGenerate.seed} · {fmtSec(lastGenerate.elapsed_seconds)}</p>
          <div className="lab-table-wrap">
            <table className="lab-table">
              <thead><tr><th>Destino</th><th>Registos</th><th>Tamanho</th><th>Escrita</th><th>Geração</th><th /></tr></thead>
              <tbody>
                {Object.entries(lastGenerate.writes || {}).map(([name, w]) => (
                  <tr key={name}>
                    <td>{name.toUpperCase()}</td>
                    <td>{w.records?.toLocaleString('pt-PT') ?? '—'}</td>
                    <td>{fmtBytes(w.bytes)}</td>
                    <td>{fmtSec(w.write_seconds)}</td>
                    <td>{fmtSec(w.generation_seconds)}</td>
                    <td>
                      {name !== 'sql' && w.path && <DlButton onDownload={downloadFile} file={basename(w.path)} label="Descarregar" />}
                      {name === 'sql' && (
                        <>
                          <DlButton onDownload={downloadFile} file={w.create_file || 'criar_dados.sql'} label="Criar SQL" />
                          {' '}
                          <DlButton onDownload={downloadFile} file={w.delete_file || 'apagar_dados.sql'} label="Apagar SQL" />
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="lab-meta" style={{ marginTop: 12 }}>
            Relatórios: <DlButton onDownload={downloadFile} file="run_meta.json" label="Metadados" />{' '}
            <DlButton onDownload={downloadFile} file="schema.avsc" label="Schema Avro" />{' '}
            <DlButton onDownload={downloadFile} file="run.log" label="Log" />
            {lastBench && <>{' '}<DlButton onDownload={downloadFile} file="benchmark_report.json" label="Benchmark JSON" /></>}
            {lastValidate && <>{' '}<DlButton onDownload={downloadFile} file="validation_report.json" label="Validação JSON" /></>}
          </p>
        </Card>
      )}

      {lastValidate && (
        <Card className="lab-card">
          <h3 className="lab-card-title">Validação dos destinos</h3>
          <div className={`lab-validation-status ${lastValidate.equivalent ? 'ok' : 'bad'}`}>
            <strong>{lastValidate.equivalent ? 'Equivalência confirmada' : 'Diferenças detectadas'}</strong>
            <span>{lastValidate.summary}</span>
          </div>
          {Array.isArray(lastValidate.checks) && (
            <div className="lab-validation-grid">
              {lastValidate.checks.map((check) => (
                <div className={`lab-check-card ${check.count_ok && check.grades_ok ? 'ok' : 'bad'}`} key={check.format}>
                  <strong>{check.format.toUpperCase()}</strong>
                  <span>Alunos: {check.count_ok ? '✓' : '×'} {check.count?.toLocaleString('pt-PT')} / {check.expected?.toLocaleString('pt-PT')}</span>
                  <span>Notas: {check.grades_ok ? '✓' : '×'} {check.grade_records?.toLocaleString('pt-PT')} / {check.expected_grade_records?.toLocaleString('pt-PT')}</span>
                  <span>Soma das notas: {check.sum_notas}</span>
                  <span>Digest: {check.rows_digest || 'n/a (script SQL)'}</span>
                </div>
              ))}
            </div>
          )}
          <details className="lab-validation-details"><summary>Ver detalhes dos fingerprints</summary><pre className="lab-pre">{JSON.stringify(lastValidate.fingerprints, null, 2)}</pre></details>
        </Card>
      )}

      {chartData.length > 0 && (
        <Card className="lab-card">
          <h3 className="lab-card-title">Comparativo — mediana das repetições</h3>
          <div className="lab-charts">
            <div className="lab-chart"><h4><HardDrive size={14} /> Tamanho em disco</h4><ResponsiveContainer width="100%" height={260}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="formato" /><YAxis /><Tooltip formatter={(v) => fmtBytes(v)} /><Bar dataKey="bytes" name="Bytes" fill="var(--laranja)" /></BarChart></ResponsiveContainer></div>
            <div className="lab-chart"><h4><Gauge size={14} /> Tempo de escrita</h4><ResponsiveContainer width="100%" height={260}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="formato" /><YAxis /><Tooltip formatter={(v) => fmtSec(v)} /><Bar dataKey="write_s" name="Segundos" fill="#bc6c25" /></BarChart></ResponsiveContainer></div>
            <div className="lab-chart"><h4><Gauge size={14} /> Tempo completo de leitura</h4><ResponsiveContainer width="100%" height={260}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="formato" /><YAxis /><Tooltip formatter={(v) => fmtSec(v)} /><Bar dataKey="read_s" name="Segundos" fill="var(--castanho-medio)" /></BarChart></ResponsiveContainer></div>
            <div className="lab-chart"><h4><Cpu size={14} /> CPU média</h4><ResponsiveContainer width="100%" height={260}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="formato" /><YAxis /><Tooltip formatter={(v) => `${Number(v).toFixed(1)} %`} /><Bar dataKey="cpu_pct" name="CPU %" fill="#b56576" /></BarChart></ResponsiveContainer></div>
            <div className="lab-chart"><h4>Pico RSS observado</h4><ResponsiveContainer width="100%" height={260}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="formato" /><YAxis /><Tooltip formatter={(v) => fmtMb(v)} /><Bar dataKey="rss_mb" name="RSS" fill="#6a994e" /></BarChart></ResponsiveContainer></div>
          </div>
        </Card>
      )}

      {lastBench && (
        <Card className="lab-card">
          <h3 className="lab-card-title">Estatísticas detalhadas do benchmark</h3>
          <p className="lab-meta">Tempos em segundos. A 1.ª execução (fria) é reportada à parte e excluída da mediana. Compressão = tamanho do formato / tamanho do CSV.</p>
          <div className="lab-benchmark-table-wrap">
            <table className="lab-benchmark-table">
              <thead>
                <tr><th>Formato</th><th>Tamanho</th><th>Compressão</th><th>Escrita</th><th>Leitura total</th><th>1 coluna</th><th>Agregação</th><th>CPU %</th><th>Pico RSS</th><th>Modo</th></tr>
              </thead>
              <tbody>
                {Object.entries(lastBench.formats || {}).map(([name, m]) => (
                  <tr key={name}>
                    <td>{name.toUpperCase()}</td>
                    <td>{fmtBytes(m.bytes)}</td>
                    <td>{m.compression_vs_csv != null ? `${m.compression_vs_csv.toFixed(2)}×` : '—'}</td>
                    <td>{fmtMetric(m.write_seconds)}</td>
                    <td>{fmtMetric(m.full_read_seconds)}</td>
                    <td>{m.column_read_seconds ? fmtMetric(m.column_read_seconds) : '—'}</td>
                    <td>{m.aggregation_seconds ? fmtMetric(m.aggregation_seconds) : '—'}</td>
                    <td>{fmtMetric(m.cpu_percent_one_core)}</td>
                    <td>{fmtMetric(m.peak_rss_mb)}</td>
                    <td>{m.read_mode || '—'}{m.column_read_mode ? ` · ${m.column_read_mode}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {status?.runs?.length > 0 && (
        <Card className="lab-card">
          <h3 className="lab-card-title">Histórico recente</h3>
          <ul className="lab-runs">
            {status.runs.map((r) => (
              <li key={r.out_dir}><strong>{r.out_dir}</strong><span>{r.records?.toLocaleString('pt-PT')} · seed {r.seed} · {r.created_at ? new Date(r.created_at).toLocaleString('pt-PT') : '—'}</span></li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}