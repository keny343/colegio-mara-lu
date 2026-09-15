import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import api from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { Button, Input, Select, FormField, LoadingState, ErrorState } from '../components/ui';
import './InscricaoPublica.css';

export default function InscricaoPublica() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [biFile, setBiFile] = useState(null);
  const [historicoFile, setHistoricoFile] = useState(null);

  const { data: series = [], loading: loadingSeries, error: seriesError, refetch: reloadSeries } = useFetch(
    (signal) => api.get('/series', { signal }),
    []
  );

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

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

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
      const selectedSerie = series.find((s) => String(s.id) === String(form.serie_id));
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

  const niveis = [...new Set(series.map((s) => s.nivel))];
  const selectedSerie = series.find((s) => String(s.id) === String(form.serie_id));
  const classeNumero = classeNumeroDaSerie(selectedSerie?.nome);
  const precisaBoletim = typeof classeNumero === 'number' && classeNumero >= 2;

  if (success) {
    return (
      <div className="insc-shell insc-shell--success">
        <div className="insc-success">
          <CheckCircle size={48} strokeWidth={1.75} className="insc-success-icon" aria-hidden="true" />
          <h1>Inscrição enviada</h1>
          <p>
            A secretaria vai analisar os dados e documentos. Depois da aprovação,
            o aluno entra no portal com o BI (senha inicial = BI).
          </p>
          <Link to="/login" className="btn btn-primary">Ir para o login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="insc-shell">
      <aside className="insc-aside" aria-label="Sobre a inscrição">
        <Link to="/" className="insc-back">
          <ArrowLeft size={16} strokeWidth={2} />
          Voltar
        </Link>
        <div className="insc-aside-body">
          <p className="insc-aside-kicker">Ano letivo {form.ano_letivo}</p>
          <h1 className="insc-aside-title">
            Inscrição<br />
            <em>online</em>
          </h1>
          <p className="insc-aside-lede">
            Preencha os dados do aluno. Em poucos minutos a candidatura fica
            registada para análise do colégio.
          </p>
          <ul className="insc-aside-list">
            <li>BI digitalizado (obrigatório)</li>
            <li>Boletim só a partir da 2.ª classe</li>
            <li>Acompanhamento após aprovação</li>
          </ul>
        </div>
        <p className="insc-aside-foot">Colégio Mara &amp; Lu</p>
      </aside>

      <main className="insc-main">
        <div className="insc-main-inner">
          <header className="insc-main-head">
            <h2>Dados do aluno</h2>
            <p>Campos marcados são obrigatórios. Já tem conta? <Link to="/login">Entrar</Link></p>
          </header>

          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {loadingSeries ? (
            <LoadingState label="A carregar classes..." />
          ) : seriesError ? (
            <ErrorState error={seriesError} onRetry={reloadSeries} />
          ) : (
            <form onSubmit={handleSubmit} noValidate className="insc-form">
              <fieldset className="insc-fieldset">
                <legend>Identificação</legend>
                <div className="form-row">
                  <FormField label="Primeiro Nome" htmlFor="insc-primeiro-nome" required>
                    <Input id="insc-primeiro-nome" name="primeiro_nome" value={form.primeiro_nome} onChange={handleChange} required autoComplete="given-name" />
                  </FormField>
                  <FormField label="Último Nome" htmlFor="insc-ultimo-nome" required>
                    <Input id="insc-ultimo-nome" name="ultimo_nome" value={form.ultimo_nome} onChange={handleChange} required autoComplete="family-name" />
                  </FormField>
                </div>

                <div className="form-row">
                  <FormField label="Nº do Bilhete (BI)" htmlFor="insc-bi" required hint="A senha inicial do aluno será o próprio BI.">
                    <Input id="insc-bi" name="bi" value={form.bi} onChange={handleChange} required placeholder="Ex: 123456789LA123" autoComplete="off" />
                  </FormField>
                  <FormField label="Data de Nascimento" htmlFor="insc-nascimento" required>
                    <Input id="insc-nascimento" name="data_nascimento" type="date" value={form.data_nascimento} onChange={handleChange} required />
                  </FormField>
                </div>

                <FormField label="Foto/Cópia do BI" htmlFor="insc-bi-arquivo" required>
                  <Input
                    id="insc-bi-arquivo"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setBiFile(e.target.files?.[0] || null)}
                    required
                  />
                </FormField>
              </fieldset>

              <fieldset className="insc-fieldset">
                <legend>Contactos e família</legend>
                <div className="form-row">
                  <FormField label="Nacionalidade" htmlFor="insc-nacionalidade">
                    <Input id="insc-nacionalidade" name="nacionalidade" value={form.nacionalidade} onChange={handleChange} />
                  </FormField>
                  <FormField label="Telefone de Emergência" htmlFor="insc-telefone">
                    <Input id="insc-telefone" name="telefone_emergencia" value={form.telefone_emergencia} onChange={handleChange} placeholder="+244 9xx xxx xxx" />
                  </FormField>
                </div>

                <div className="form-row">
                  <FormField label="Nome da Mãe" htmlFor="insc-mae">
                    <Input id="insc-mae" name="nome_mae" value={form.nome_mae} onChange={handleChange} />
                  </FormField>
                  <FormField label="Nome do Pai" htmlFor="insc-pai">
                    <Input id="insc-pai" name="nome_pai" value={form.nome_pai} onChange={handleChange} />
                  </FormField>
                </div>

                {precisaBoletim && (
                  <>
                    <FormField label="Nome do Encarregado" htmlFor="insc-encarregado" required>
                      <Input id="insc-encarregado" name="nome_encarregado" value={form.nome_encarregado} onChange={handleChange} required />
                    </FormField>
                    <FormField label="Certificado / Boletim de Notas da Classe Anterior" htmlFor="insc-boletim" required>
                      <Input
                        id="insc-boletim"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setHistoricoFile(e.target.files?.[0] || null)}
                        required
                      />
                    </FormField>
                  </>
                )}
              </fieldset>

              <fieldset className="insc-fieldset">
                <legend>Classe pretendida</legend>
                <div className="form-row">
                  <FormField label="Classe" htmlFor="insc-serie" required>
                    <Select id="insc-serie" name="serie_id" value={form.serie_id} onChange={handleChange} required>
                      <option value="">Selecionar...</option>
                      {niveis.map((nivel) => (
                        <optgroup key={nivel} label={nivel}>
                          {series.filter((s) => s.nivel === nivel).map((s) => (
                            <option key={s.id} value={s.id} disabled={s.vagas_disponiveis <= 0}>
                              {s.nome} {s.vagas_disponiveis <= 0 ? '(Sem vagas)' : `(${s.vagas_disponiveis} vagas)`}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Ano Letivo" htmlFor="insc-ano" required>
                    <Select id="insc-ano" name="ano_letivo" value={form.ano_letivo} onChange={handleChange}>
                      <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                      <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
                    </Select>
                  </FormField>
                </div>
              </fieldset>

              <p className="insc-note">
                Depois de enviar, o colégio analisa a inscrição. Só após aprovação o aluno acede ao portal.
              </p>

              <Button type="submit" variant="primary" block loading={saving}>
                {saving ? 'A enviar...' : 'Enviar inscrição'}
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
