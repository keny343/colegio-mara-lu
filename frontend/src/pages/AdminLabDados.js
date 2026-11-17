import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
const PRESETS = [
  { id: '1000', label: 'Smoke — 1 000', records: 1000 },
  { id: '5000', label: 'Demo — 5 000', records: 5000 },
  { id: '10000', label: 'Demo+ — 10 000', records: 10000 },
  { id: '25000', label: 'Máx. painel — 25 000', records: 25000 },
];

function fmtBytes(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const bytes = Number(value);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
}
function fmtSec(value) {
  return value == null || Number.isNaN(Number(value)) ? '—' : `${Number(value).toFixed(3)} s`;
}
function fmtMb(value) {
  return value == null || Number.isNaN(Number(value)) ? '—' : `${Number(value).toFixed(1)} MB`;
}
function fmtMetric(metric, suffix = '') {
  if (!metric || typeof metric !== 'object' || metric.median == null) return '—';
  return `med ${Number(metric.median).toFixed(3)}${suffix} · mín ${Number(metric.min).toFixed(3)}${suffix} · máx ${Number(metric.max).toFixed(3)}${suffix}`;
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
  const [dests, setDests] = useState(() => new Set(ALL_DESTS.map((item) => item.id)));
  const [lastGenerate, setLastGenerate] = useState(null);
  const [lastValidate, setLastValidate] = useState(null);
  const [lastBench, setLastBench] = useState(null);

  const loadStatus = useCallback(async () => {
    const response = await api.get('/admin/lab/status');
    setStatus(response.data);
    if (response.data?.latest?.benchmark) {
      setLastBench(response.data.latest.benchmark);
      if (response.data.latest.writes) setLastGenerate(response.data.latest);
    } else if (response.data?.latest?.writes) setLastGenerate(response.data.latest);
    return response.data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadStatus();
      } catch (error) {
        if (!cancelled) notifyError(error.response?.data?.message || 'Não foi possível carregar o laboratório.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadStatus, notifyError]);

  const records = useMemo(() => PRESETS.find((item) => item.id === preset)?.records || 1000, [preset]);
  const destinationList = useMemo(() => [...dests].join(','), [dests]);
  const payload = () => ({
    records,
    seed: Number(seed) || 42,
    batch_size: Number(batchSize) || 2000,
    destinations: destinationList,
    repeats: 5,
  });

  const toggleDest = (id) => {
    setDests((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        if (next.size === 1) return previous;
        next.delete(id);
      } else next.add(id);
      return next;
    });
  };

  const runGenerate = async () => {
    setBusy('generate');
    try {
      const response = await api.post('/admin/lab/generate', payload(), { timeout: 0 });
      setLastGenerate(response.data);
      setLastValidate(null);
      notifySuccess(`Gerados ${response.data.records} registos em ${fmtSec(response.data.elapsed_seconds)}.`);
      await loadStatus();
    } catch (error) {
      notifyError(error.response?.data?.message || 'Falha na geração.');
    } finally { setBusy(null); }
  };

  const runValidate = async () => {
    const outDir = lastGenerate?.out_dir || status?.latest?.out_dir;
    if (!outDir) { notifyError('Gere dados primeiro.'); return; }
    setBusy('validate');
    try {
      const response = await api.post('/admin/lab/validate', { out_dir: outDir, sample_size: 100 }, { timeout: 0 });
      setLastValidate(response.data);
      notifySuccess(response.data.equivalent ? 'Destinos equivalentes.' : 'Validação parcial ou com diferenças.');
      await loadStatus();
    } catch (error) {
      notifyError(error.response?.data?.message || 'Falha na validação.');
    } finally { setBusy(null); }
  };

  const runBenchmark = async () => {
    setBusy('benchmark');
    try {
      const response = await api.post('/admin/lab/benchmark', payload(), { timeout: 0 });
      setLastBench(response.data);
      setLastGenerate({
        out_dir: response.data.out_dir,
        records: response.data.records,
        seed: response.data.seed,
        elapsed_seconds: response.data.elapsed_seconds,
        writes: response.data.writes || {},
      });
      notifySuccess('Benchmark concluído com 5 repetições.');
      await loadStatus();
    } catch (error) {
      notifyError(error.response?.data?.message || 'Falha no benchmark.');
    } finally { setBusy(null); }
  };

  const chartData = useMemo(() => {
    const formats = lastBench?.formats || lastGenerate?.writes;
    if (!formats) return [];
    return Object.entries(formats).map(([name, metrics]) => ({
      formato: name.toUpperCase(),
      bytes: metrics.bytes ?? 0,
      readSeconds: metrics.full_read_seconds?.median ?? 0,
      cpuPercent: metrics.cpu_percent_one_core?.median ?? 0,
      rssMb: metrics.peak_rss_mb?.median ?? 0,
    }));
  }, [lastBench, lastGenerate]);

  const downloadHref = (file) => {
    const outDir = lastGenerate?.out_dir || lastBench?.out_dir || status?.latest?.out_dir;
    if (!outDir || !file) return undefined;
    const base = String(api.defaults.baseURL || '/api').replace(/\/$/, '');
    return `${base}/admin/lab/download/${encodeURIComponent(outDir)}/${encodeURIComponent(file)}`;
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
          <FormField label="Volume">
            <Select value={preset} onChange={(event) => setPreset(event.target.value)} disabled={!!busy}>
              {PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </Select>
          </FormField>
          <FormField label="Seed"><Input type="number" value={seed} onChange={(event) => setSeed(event.target.value)} disabled={!!busy} /></FormField>
          <FormField label="Tamanho do lote"><Input type="number" min="1" value={batchSize} onChange={(event) => setBatchSize(event.target.value)} disabled={!!busy} /></FormField>
          <FormField label="Repetições"><Input type="number" value="5" disabled /></FormField>
        </div>
        <fieldset className="lab-dests" disabled={!!busy}>
          <legend>Destinos</legend>
          {ALL_DESTS.map((item) => (
            <label key={item.id} className="lab-check">
              <input type="checkbox" checked={dests.has(item.id)} onChange={() => toggleDest(item.id)} />
              {item.label}
            </label>
          ))}
        </fieldset>
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
          <div className="lab-table-wrap">
            <table className="lab-table">
              <thead><tr><th>Destino</th><th>Registos</th><th>Tamanho</th><th>Escrita</th><th>Download</th></tr></thead>
              <tbody>{Object.entries(lastGenerate.writes || {}).map(([name, write]) => (
                <tr key={name}>
                  <td>{name.toUpperCase()}</td>
                  <td>{write.records?.toLocaleString('pt-PT') ?? '—'}</td>
                  <td>{fmtBytes(write.bytes)}</td>
                  <td>{fmtSec(write.write_seconds)}</td>
                  <td>
                    {name !== 'sql' && write.path && <a className="lab-dl" href={downloadHref(basename(write.path))} download={basename(write.path)}><Download size={14} /> Descarregar</a>}
                    {name === 'sql' && <>
                      <a className="lab-dl" href={downloadHref(write.create_file || 'criar_dados.sql')} download="criar_dados.sql"><Download size={14} /> Criar SQL</a>{' '}
                      <a className="lab-dl" href={downloadHref(write.delete_file || 'apagar_dados.sql')} download="apagar_dados.sql"><Download size={14} /> Apagar SQL</a>
                    </>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      )}

      {lastValidate && (
        <Card className="lab-card">
          <h3 className="lab-card-title">Validação dos destinos</h3>
          <div className={`lab-validation-status ${lastValidate.equivalent ? 'ok' : lastValidate.status === 'partial' ? 'partial' : 'bad'}`}>
            <strong>{lastValidate.status === 'equivalent' ? 'Equivalência confirmada' : lastValidate.status === 'partial' ? 'Validação parcial' : 'Diferenças detectadas'}</strong>
            <span>{lastValidate.summary || 'Consulte os resultados por formato abaixo.'}</span>
          </div>
          {Array.isArray(lastValidate.checks) && <div className="lab-validation-grid">
            {lastValidate.checks.map((check) => (
              <div className={`lab-check-card ${check.count_ok && check.grades_ok ? 'ok' : 'bad'}`} key={check.format}>
                <strong>{check.format.toUpperCase()}</strong>
                <span>Alunos: {check.count_ok ? '✓' : '×'} {check.count?.toLocaleString('pt-PT') ?? 'n/d'} / {check.expected?.toLocaleString('pt-PT') ?? 'n/d'}</span>
                <span>Notas: {check.grades_ok ? '✓' : '×'} {check.grade_records?.toLocaleString('pt-PT') ?? 'n/d'} / {check.expected_grade_records?.toLocaleString('pt-PT') ?? 'n/d'}</span>
              </div>
            ))}
          </div>}
          <details className="lab-validation-details">
            <summary>Ver detalhes dos fingerprints</summary>
            <pre className="lab-pre">{JSON.stringify(lastValidate.fingerprints, null, 2)}</pre>
          </details>
        </Card>
      )}

      {chartData.length > 0 && (
        <Card className="lab-card">
          <h3 className="lab-card-title">Comparativo — mediana das 5 repetições</h3>
          <div className="lab-charts">
            <div className="lab-chart"><h4><HardDrive size={14} /> Tamanho em disco</h4><ResponsiveContainer width="100%" height={260}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="formato" /><YAxis /><Tooltip formatter={(value) => fmtBytes(value)} /><Bar dataKey="bytes" name="Bytes" fill="var(--laranja)" /></BarChart></ResponsiveContainer></div>
            <div className="lab-chart"><h4><Gauge size={14} /> Tempo completo de leitura</h4><ResponsiveContainer width="100%" height={260}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="formato" /><YAxis /><Tooltip formatter={(value) => fmtSec(value)} /><Bar dataKey="readSeconds" name="Segundos" fill="var(--castanho-medio)" /></BarChart></ResponsiveContainer></div>
            <div className="lab-chart"><h4><Cpu size={14} /> CPU média (% de um core)</h4><ResponsiveContainer width="100%" height={260}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="formato" /><YAxis /><Tooltip formatter={(value) => `${Number(value).toFixed(1)} %`} /><Bar dataKey="cpuPercent" name="CPU %" fill="#b56576" /></BarChart></ResponsiveContainer></div>
            <div className="lab-chart"><h4>Pico RSS observado</h4><ResponsiveContainer width="100%" height={260}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="formato" /><YAxis /><Tooltip formatter={(value) => fmtMb(value)} /><Bar dataKey="rssMb" name="RSS" fill="#6a994e" /></BarChart></ResponsiveContainer></div>
          </div>
        </Card>
      )}

      {lastBench && (
        <Card className="lab-card">
          <h3 className="lab-card-title">Estatísticas detalhadas do benchmark</h3>
          <div className="lab-benchmark-table-wrap">
            <table className="lab-benchmark-table">
              <thead><tr><th>Formato</th><th>Leitura (s): med · mín · máx</th><th>CPU (%): med · mín · máx</th><th>RSS (MB): med · mín · máx</th><th>Modo de leitura</th></tr></thead>
              <tbody>{Object.entries(lastBench.formats || {}).map(([name, metric]) => (
                <tr key={name}>
                  <td>{name.toUpperCase()}</td>
                  <td>{fmtMetric(metric.full_read_seconds)}</td>
                  <td>{fmtMetric(metric.cpu_percent_one_core, '%')}</td>
                  <td>{fmtMetric(metric.peak_rss_mb, ' MB')}</td>
                  <td>{metric.read_mode || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {lastBench.cold_cache_note && <p className="lab-meta">{lastBench.cold_cache_note}</p>}
        </Card>
      )}

      {status?.runs?.length > 0 && (
        <Card className="lab-card">
          <h3 className="lab-card-title">Histórico recente</h3>
          <ul className="lab-runs">{status.runs.map((run) => (
            <li key={run.out_dir}><strong>{run.out_dir}</strong><span>{run.records?.toLocaleString('pt-PT')} · seed {run.seed} · {run.created_at ? new Date(run.created_at).toLocaleString('pt-PT') : '—'}</span></li>
          ))}</ul>
        </Card>
      )}
    </div>
  );
}
