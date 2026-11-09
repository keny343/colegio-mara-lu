import React, { useState } from 'react';
import { Printer, Download } from 'lucide-react';
import api from '../services/api';
import { Button, Select } from './ui';
import './RelatorioNotasBotoes.css';
import { abrirJanelaRelatorio, imprimirRelatorio, descarregarFormato } from '../utils/relatorioNotas';
import { FORMATOS_EXPORT } from '../utils/exportFormatos';

/**
 * Relatório de notas.
 * - Sem disciplina: relatório geral (todas as disciplinas acessíveis ao perfil).
 * - Com disciplina: relatório só dessa disciplina.
 * Admin: geral ou qualquer disciplina da turma.
 * Coordenador: só turmas/disciplinas da sua coordenação.
 * Professor: só disciplinas que leciona.
 */
export default function RelatorioNotasBotoes({
  turmaId,
  disciplinaId,
  disciplinaNome,
  baseNotas,
  geradoPor,
  onErro,
  onSucesso,
}) {
  const [aGerar, setAGerar] = useState(null);
  const [formato, setFormato] = useState('csv');

  const temDisciplina = disciplinaId !== null && disciplinaId !== undefined && String(disciplinaId) !== '';
  const ambito = temDisciplina
    ? `disciplina: ${disciplinaNome || 'seleccionada'}`
    : 'geral (todas as disciplinas permitidas)';

  const buscar = async () => {
    const params = temDisciplina ? { disciplina_id: disciplinaId } : {};
    const res = await api.get(`${baseNotas}/turmas/${turmaId}/relatorio-notas`, { params });
    return res.data;
  };

  const gerarPdf = async () => {
    if (!turmaId || aGerar) return;
    const janela = abrirJanelaRelatorio();
    if (!janela) {
      onErro?.('O navegador bloqueou a janela do relatório. Permita pop-ups para este site e tente de novo.');
      return;
    }
    setAGerar('pdf');
    try {
      const dados = await buscar();
      imprimirRelatorio(janela, dados, { geradoPor });
      onSucesso?.(`Relatório ${ambito} pronto. Na impressão, escolha "Guardar como PDF".`);
    } catch (e) {
      janela.close();
      onErro?.(e.response?.data?.message || 'Não foi possível gerar o relatório.');
    } finally {
      setAGerar(null);
    }
  };

  const exportar = async () => {
    if (!turmaId || aGerar) return;
    setAGerar('export');
    try {
      const dados = await buscar();
      descarregarFormato(formato, dados);
      const label = FORMATOS_EXPORT.find((f) => f.id === formato)?.label || formato.toUpperCase();
      onSucesso?.(`Ficheiro ${label} descarregado (${ambito}).`);
    } catch (e) {
      onErro?.(e.response?.data?.message || 'Não foi possível exportar as notas.');
    } finally {
      setAGerar(null);
    }
  };

  return (
    <div className="relatorio-acoes">
      <p className="relatorio-ambito">
        Âmbito do relatório: <strong>{temDisciplina ? (disciplinaNome || 'disciplina seleccionada') : 'geral da turma'}</strong>
        {!temDisciplina && ' — seleccione uma disciplina acima para exportar só essa.'}
      </p>
      <div className="relatorio-acoes-row">
        <Button
          variant="primary"
          icon={<Printer size={16} />}
          onClick={gerarPdf}
          loading={aGerar === 'pdf'}
          disabled={!turmaId || !!aGerar}
        >
          Relatório (PDF)
        </Button>
        <Select
          id="relatorio-formato"
          value={formato}
          onChange={(e) => setFormato(e.target.value)}
          disabled={!!aGerar}
          aria-label="Formato de exportação"
        >
          {FORMATOS_EXPORT.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </Select>
        <Button
          variant="outline"
          icon={<Download size={16} />}
          onClick={exportar}
          loading={aGerar === 'export'}
          disabled={!turmaId || !!aGerar}
        >
          Exportar
        </Button>
      </div>
    </div>
  );
}
