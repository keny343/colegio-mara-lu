import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, CheckCircle } from 'lucide-react';
import api from '../services/api';

export default function InscricaoPublica() {
  const navigate = useNavigate();
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [biFile, setBiFile] = useState(null);
  const [historicoFile, setHistoricoFile] = useState(null);

  const [form, setForm] = useState({
    primeiro_nome: '',
    ultimo_nome: '',
    bi: '',
    data_nascimento: '',
    nacionalidade: 'Angolana',
    nome_mae: '',
    nome_pai: '',
    telefone_emergencia: '',
    nome_encarregado: '',
    serie_id: '',
    ano_letivo: new Date().getFullYear() + 1,
  });

  useEffect(() => {
    api.get('/series')
      .then(r => setSeries(r.data))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const classeNumeroDaSerie = (nome) => {
    if (!nome) return null;
    const lower = String(nome).toLowerCase();
    if (lower.includes('pré') || lower.includes('pre') || lower.includes('maternal') || lower.includes('jardim')) return 0;
    const m = lower.match(/(\d{1,2})\s*[ªº]?\s*(classe|ano)/);
    if (m) return parseInt(m[1], 10);
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const selectedSerie = series.find(s => String(s.id) === String(form.serie_id));
      const classeNumero = classeNumeroDaSerie(selectedSerie?.nome);
      const precisaBoletim = typeof classeNumero === 'number' && classeNumero >= 2;

      if (!biFile) return setError('Envie a cópia/foto do BI (bilhete de identidade).');
      if (precisaBoletim && !historicoFile) return setError('Envie o certificado/boletim de notas da classe anterior.');
      if (precisaBoletim && !String(form.nome_encarregado || '').trim()) return setError('Informe o nome do encarregado.');

      const fd = new FormData();
      fd.append('primeiro_nome', (form.primeiro_nome || '').trim());
      fd.append('ultimo_nome', (form.ultimo_nome || '').trim());
      fd.append('bi', (form.bi || '').trim());
      fd.append('data_nascimento', form.data_nascimento);
      fd.append('nacionalidade', form.nacionalidade || '');
      fd.append('nome_mae', form.nome_mae || '');
      fd.append('nome_pai', form.nome_pai || '');
      fd.append('telefone_emergencia', form.telefone_emergencia || '');
      fd.append('nome_encarregado', (form.nome_encarregado || '').trim());
      fd.append('serie_id', form.serie_id);
      fd.append('ano_letivo', form.ano_letivo);

      fd.append('bi_arquivo', biFile);
      if (precisaBoletim) fd.append('historico_arquivo', historicoFile);

      await api.post('/public/inscricoes', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao enviar inscrição.');
    } finally {
      setSaving(false);
    }
  };

  const niveis = [...new Set(series.map(s => s.nivel))];
  const selectedSerie = series.find(s => String(s.id) === String(form.serie_id));
  const classeNumero = classeNumeroDaSerie(selectedSerie?.nome);
  const precisaBoletim = typeof classeNumero === 'number' && classeNumero >= 2;

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--castanho), var(--castanho-medio))', padding: '2rem' }}>
        <div className="card" style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>
          <CheckCircle size={56} color="var(--verde)" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ color: 'var(--castanho)', marginBottom: '0.5rem' }}>Inscrição enviada!</h2>
          <p style={{ color: 'var(--cinza)', marginBottom: '1.5rem' }}>
            Aguarde a aprovação/matrícula do colégio. Depois disso, você poderá entrar com o seu BI (senha = BI).
          </p>
          <Link to="/login" className="btn btn-primary btn-full">Ir para o Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, var(--castanho) 0%, var(--castanho-medio) 100%)', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: 720 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: 64, height: 64, background: 'var(--laranja)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <GraduationCap size={32} color="white" />
          </div>
          <h2 style={{ color: 'white', fontSize: '1.8rem' }}>Inscrição do Aluno</h2>
          <p style={{ color: 'var(--bege)', marginTop: 4 }}>Preencha os dados do aluno para iniciar o processo</p>
        </div>

        <div className="card">
          {error && <div className="alert alert-error">{error}</div>}
          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Primeiro Nome *</label>
                  <input name="primeiro_nome" className="form-control" value={form.primeiro_nome} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Último Nome *</label>
                  <input name="ultimo_nome" className="form-control" value={form.ultimo_nome} onChange={handleChange} required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nº do Bilhete (BI) *</label>
                  <input name="bi" className="form-control" value={form.bi} onChange={handleChange} required placeholder="Ex: 123456789LA123" />
                  <div style={{ fontSize: '0.8rem', color: 'var(--cinza)', marginTop: 6 }}>
                    A senha inicial do aluno será o próprio BI.
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Data de Nascimento *</label>
                  <input name="data_nascimento" type="date" className="form-control" value={form.data_nascimento} onChange={handleChange} required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Foto/Cópia do BI *</label>
                  <input
                    type="file"
                    className="form-control"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => setBiFile(e.target.files?.[0] || null)}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nacionalidade</label>
                  <input name="nacionalidade" className="form-control" value={form.nacionalidade} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefone de Emergência</label>
                  <input name="telefone_emergencia" className="form-control" value={form.telefone_emergencia} onChange={handleChange} placeholder="+244 9xx xxx xxx" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nome da Mãe</label>
                  <input name="nome_mae" className="form-control" value={form.nome_mae} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Nome do Pai</label>
                  <input name="nome_pai" className="form-control" value={form.nome_pai} onChange={handleChange} />
                </div>
              </div>

              {precisaBoletim && (
                <>
                  <div className="form-row">
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Nome do Encarregado *</label>
                      <input
                        name="nome_encarregado"
                        className="form-control"
                        value={form.nome_encarregado}
                        onChange={handleChange}
                        required={precisaBoletim}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Certificado / Boletim de Notas da Classe Anterior *</label>
                      <input
                        type="file"
                        className="form-control"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={e => setHistoricoFile(e.target.files?.[0] || null)}
                        required={precisaBoletim}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Classe *</label>
                  <select name="serie_id" className="form-control form-select" value={form.serie_id} onChange={handleChange} required>
                    <option value="">Selecionar...</option>
                    {niveis.map(nivel => (
                      <optgroup key={nivel} label={nivel}>
                        {series.filter(s => s.nivel === nivel).map(s => (
                          <option key={s.id} value={s.id} disabled={s.vagas_disponiveis <= 0}>
                            {s.nome} {s.vagas_disponiveis <= 0 ? '(Sem vagas)' : `(${s.vagas_disponiveis} vagas)`}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Ano Letivo *</label>
                  <select name="ano_letivo" className="form-control form-select" value={form.ano_letivo} onChange={handleChange}>
                    <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                    <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
                  </select>
                </div>
              </div>

              <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
                Depois de enviar, o colégio vai analisar a sua inscrição e os documentos. Só após aprovação o aluno consegue entrar no portal.
              </div>

              <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
                {saving ? 'Enviando...' : 'Enviar Inscrição'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--bege)' }}>
                <p style={{ color: 'var(--cinza)', fontSize: '0.9rem' }}>
                  Já tem inscrição aprovada? <Link to="/login" style={{ color: 'var(--laranja)', fontWeight: 600 }}>Entrar</Link>
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

