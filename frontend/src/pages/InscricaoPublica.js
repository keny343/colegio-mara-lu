import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, CheckCircle } from 'lucide-react';
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
    () => api.get('/series'),
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
      <div className="insc-success-screen">
        <div className="card insc-success-card">
          <CheckCircle size={56} color="var(--verde)" className="insc-success-icon" />
          <h2>Inscrição enviada!</h2>
          <p>Aguarde a aprovação/matrícula do colégio. Depois disso, você poderá entrar com o seu BI (senha = BI).</p>
          <Link to="/login" className="btn btn-primary btn-full">Ir para o Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="insc-screen">
      <div className="insc-container">
        <div className="insc-header">
          <div className="insc-icon">
            <GraduationCap size={32} color="white" />
          </div>
          <h2>Inscrição do Aluno</h2>
          <p>Preencha os dados do aluno para iniciar o processo</p>
        </div>

        <div className="card">
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {loadingSeries ? (
            <LoadingState label="A carregar classes..." />
          ) : seriesError ? (
            <ErrorState error={seriesError} onRetry={reloadSeries} />
          ) : (
            <form onSubmit={handleSubmit} noValidate>
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

              <div className="alert alert-info">
                Depois de enviar, o colégio vai analisar a sua inscrição e os documentos. Só após aprovação o aluno consegue entrar no portal.
              </div>

              <Button type="submit" variant="primary" block loading={saving}>
                {saving ? 'Enviando...' : 'Enviar Inscrição'}
              </Button>

              <div className="insc-footer">
                <p>
                  Já tem inscrição aprovada? <Link to="/login">Entrar</Link>
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
