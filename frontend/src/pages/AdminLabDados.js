import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
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

export default function AdminLabDados() {
  const { error: notifyError, success: notifySuccess } = useNotification();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [status, setStatus] = useState(null);
  const [preset, setPreset] = useState('1000');
  const [seed, setSeed] = useState(42);
  const [batchSize, setBatchSize] = useState(2000);
  const [dests, setDests] = useState(() => new Set(ALL_DESTS.map((d) => d.id)));
  const [lastGenerate, setLastGenerate] = useState(null);
  const [lastValidate, setLastValidate] = useState(null);
  const [lastBench, setLastBench] = useState(null);

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

  const records = useMemo(() => PRESETS.find((p) => p.id === preset)?.records || 1000, [preset]);
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
    records,
    seed: Number(seed) || 42,
    batch_size: Number(batchSize) || 2000,
    destinations: destList,
    repeats: 5,
  });

  const runGenerate = async () => {
    setBusy('generate');
    try {
      const res = await api.post('/admin/lab/generate', payload(), { timeout: 0 });
      setLastGenerate(res.data);
      setLastValidate(null);
      notifySuccess(`Gerados ${res.data.records} registos em ${fmtSec(res.data.elapsed_seconds)}.`);
      await loadStatus();
    } catch (e) {
      notifyError(e.response?.data?.message || 'Falha na geração.');
    } finally { setBusy(null); }
  };

  const runValidate = async () => {
    const out = lastGenerate?.out_dir || status?.latest?.out_dir;
    if (!out) { notifyError('Gere dados primeiro.'); return; }
    setBusy('validate');
    try {
      const res = await api.post('/admin/lab/validate', { out_dir: out, sample_size: 100 }, { timeout: 0 });
      setLastValidate(res.data);
      notifySuccess(res.data.equivalent ? 'Destinos equivalentes.' : 'Validação parcial ou com diferenças.');
      await loadStatus();
    } catch (e) { notifyError(e.response?.data?.message || 'Falha na validação.'); }
    finally { setBusy(null); }
  };

  const runBenchmark = async () => {
    setBusy('benchmark');
    try {
      const res = await api.post('/admin/lab/benchmark', payload(), { timeout: 0 });
      setLastBench(res.data);
      setLastGenerate({ out_dir: res.data.out_dir, records: res.data.records, seed: res.data.seed, elapsed_seconds: res.data.elapsed_seconds, writes: res.data.writes || {} });
      notifySuccess('Benchmark concluído com 5 repetições.');
      await loadStatus();
    } catch (e) { notifyError(e.response?.data?.message || 'Falha no benchmark.'); }
    finally { setBusy(null); }
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
      rps: m.write_records_per_sec?.median ?? 0,
    }));
  }, [lastBench, lastGenerate]);

  const downloadHref = (file) => {
    const out = lastGenerate?.out_dir || lastBench?.out_dir || status?.latest?.out_dir;
    if (!out || !file) return undefined;
    const base = String(api.defaults.baseURL || '/api').replace(/\/$/, '');
    return `${base}/admin/lab/download/${encodeURIComponent(out)}/${encodeURIComponent(file)}`;
  };

  if (loading) return <LoadingState />;

  return (
    <div className="lab-page">
      <header className="page-header">
        <div>
          <p className="lab-eyebrow"><Database size={14} /> Engenharia de armazenamento</p>
          <h2 className="page-header-title">Laboratório de dados</h2>
          <p className="page-header-sub">
            Gerar, gravar, validar e comparar JSONL · CSV · Avro · Parquet · SQL (MySQL).
            Máximo no painel: {status?.max_records?.toLocaleString('pt-PT') || '25 000'} registos.
          </p>
        </div>
      </header>

      <Card className="lab-card">
        <h3 className="lab-card-title">Parâmetros</h3>
        <div className="lab-grid">
          <FormField label="Volume"><Select value={preset} onChange={(e) => setPreset(e.target.value)} disabled={!!busy}>{PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select></FormField>
          <FormField label="Seed"><Input type="number" value={seed} onChange={(e) => setSeed(e.target.value)} disabled={!!busy} /></FormField>
          <FormField label="Tamanho do lote"><Input type="number" min="1" value={batchSize} onChange={(e) => setBatchSize(e.target.value)} disabled={!!busy} /></FormField>
          <FormField label="Repetições"><Input type="number" value="5" disabled /></FormField>
        </div>
        <fieldset className="lab-dests" disabled={!!busy}><legend>Destinos</legend>{ALL_DESTS.map((d) => (
          <label key={d.id} className="lab-check"><input type="checkbox" checked={dests.has(d.id)} onChange={() => toggleDest(d.id)} />{d.label}</label>
        ))}</fieldset>
        <div className="lab-actions">
          <Button variant="primary" icon={<Play size={16} />} loading={busy === 'generate'} disabled={!!busy} onClick={runGenerate}>Gerar e gravar</Button>
          <Button variant="secondary" icon={<ShieldCheck size={16} />} loading={busy === 'validate'} disabled={!!busy} onClick={runValidate}>Validar equivalência</Button>
          <Button variant="secondary" icon={<Gauge size={16} />} loading={busy === 'benchmark'} disabled={!!busy} onClick={runBenchmark}>Benchmark · 5 repetições</Button>
        </div>
      </Card>

      {lastGenerate && (
        <Card className="lab-card">
          <h3 className="lab-card-title">Última geração — {lastGenerate.out_dir}</h3>
          <p className="lab-meta">{lastGenerate.records?.toLocaleString('pt-PT')} registos · seed {lastGenerate.seed} · {fmtSec(lastGenerate.elapsed_seconds)}</p>
          <div className="lab-table-wrap"><table className="lab-table"><thead><tr><th>Destino</th><th>Registos</th><th>Tamanho</th><th>Escrita</th><th></th></tr></thead><tbody>
            {Object.entries(lastGenerate.writes || {}).map(([name, w]) => (
              <tr key={name}><td>{name.toUpperCase()}</td><td>{w.records?.toLocaleString('pt-PT') ?? '—'}</td><td>{fmtBytes(w.bytes)}</td><td>{fmtSec(w.write_seconds)}</td><td>
                {name !== 'sql' && w.path && <a className="lab-dl" href={downloadHref(basename(w.path))} download={basename(w.path)}><Download size={14} /> Descarregar</a>}
                {name === 'sql' && <><a className="lab-dl" href={downloadHref(w.create_file || 'criar_dados.sql')} download="criar_dados.sql"><Download size={14} /> Criar SQL</a>{' '}<a className="lab-dl" href={downloadHref(w.delete_file || 'apagar_dados.sql')} download="apagar_dados.sql"><Download size={14} /> Apagar SQL</a></>}
              </td></tr>
            ))}
          </tbody></table></div>
        </Card>
      )}

      {lastValidate && (
        <Card className="lab-card">
          <h3 className="lab-card-title">Validação dos destinos</h3>
          <div className={`lab-validation-status ${lastValidate.equivalent ? 'ok' : lastValidate.status === 'partial' ? 'partial' : 'bad'}`}>
            <strong>{lastValidate.status === 'equivalent' ? 'Equivalência confirmada' : lastValidate.status === 'partial' ? 'Validação parcial' : 'Diferenças detectadas'}</strong>
            <span>{lastValidate.summary}</span>
          </div>
          {Array.isArray(lastValidate.checks) && <div className="lab-validation-grid">
            {lastValidate.checks.map((check) => (
              <div className={`lab-check-card ${check.count_ok && check.grades_ok ? 'ok' : 'bad'}`} key={check.format}>
                <strong>{check.format.toUpperCase()}</strong>
                <span>Alunos: {check.count_ok ? '✓' : '×'} {check.count?.toLocaleString('pt-PT')} / {check.expected?.toLocaleString('pt-PT')}</span>
                <span>Notas: {check.grades_ok ? '✓' : '×'} {check.grade_records?.toLocaleString('pt-PT')} / {check.expected_grade_records?.toLocaleString('pt-PT')}</span>
              </div>
            ))}
          </div>}
          <details className="lab-validation-details"><summary>Ver detalhes dos fingerprints</summary><pre className="lab-pre">{JSON.stringify(lastValidate.fingerprints, null, 2)}</pre></details>
        </Card>
      )}

      {chartData.length > 0 && (
        <Card className="lab-card">
          <h3 className="lab-card-title">Comparativo — mediana das 5 repetições</h3>
          <div className="lab-charts">
            <div className="lab-chart"><h4><HardDrive size={14} /> Tamanho em disco</h4><ResponsiveContainer width="100%" height={260}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="formato" /><YAxis /><Tooltip formatter={(v) => fmtBytes(v)} /><Bar dataKey="bytes" name="Bytes" fill="var(--laranja)" /></BarChart></ResponsiveContainer></div>
            <div className="lab-chart"><h4><Gauge size={14} /> Tempo completo de leitura</h4><ResponsiveContainer width="100%" height={260}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="formato" /><YAxis /><Tooltip formatter={(v) => fmtSec(v)} /><Bar dataKey="read_s" name="Segundos" fill="var(--castanho-medio)" /></BarChart></ResponsiveContainer></div>
            <div className="lab-chart"><h4><Cpu size={14} /> CPU média</h4><ResponsiveContainer width="100%" height={260}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="formato" /><YAxis /><Tooltip formatter={(v) => `${Number(v).toFixed(1)} %`} /><Bar dataKey="cpu_pct" name="CPU %" fill="#b56576" /></BarChart></ResponsiveContainer></div>
            <div className="lab-chart"><h4>Pico RSS observado</h4><ResponsiveContainer width="100%" height={260}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="formato" /><YAxis /><Tooltip formatter={(v) => fmtMb(v)} /><Bar dataKey="rss_mb" name="RSS" fill="#6a994e" /></BarChart></ResponsiveContainer></div>
          </div>
        </Card>
      )}

      {lastBench && (
        <Card className="lab-card"><h3 className="lab-card-title">Estatísticas detalhadas do benchmark</h3><div className="lab-benchmark-table-wrap"><table className="lab-benchmark-table"><thead><tr><th>Formato</th><th>Leitura total</th><th>CPU</th><th>Pico RSS</th><th>Modo</th></tr></thead><tbody>{Object.entries(lastBench.formats || {}).map(([name, metric]) => (
          <tr key={name}><td>{name.toUpper()</td><td>{fmtMetric(metric.full_read_seconds)}</td><td>{fmtMetric(metric.cpu_percent_one_core)}</td><td>{fmtMetric(metric.peak_rss_mb)}</td><td>{metric.read_mode || '—'}</td></tr>
        ))}</tbody></table></div></Card>
      )}

      {status?.runs?.length > 0 && (
        <Card className="lab-card"><h3 className="lab-card-title">Histórico recente</h3><ul className="lab-runs">{status.runs.map((r) => (
          <li key={r.out_dir}><strong>{r.out_dir}</strong><span>{r.records?.toLocaleString('pt-PT')} · seed {r.seed} · {r.created_at ? new Date(r.created_at).toLocaleString('pt-PT') : '—'}</span></li>
        ))}</ul></Card>
      )}
    </div>
  );
}
