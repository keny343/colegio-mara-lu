import React, { useState } from 'react';
import { Printer, FileSpreadsheet } from 'lucide-react';
import api from '../services/api';
import { Button } from './ui';
import './RelatorioNotasBotoes.css';
import {
  abrirJanelaRelatorio,
  imprimirRelatorio,
  descarregarCsv,
} from '../utils/relatorioNotas';

// baseNotas: '/staff' ou '/professor' (o mesmo prefixo que a página de notas usa)
export default function RelatorioNotasBotoes({ turmaId, baseNotas, geradoPor, onErro, onSucesso }) {
  const [aGerar, setAGerar] = useState(null); // 'pdf' | 'excel' | null

  const buscar = async () => {
    const res = await api.get(`${baseNotas}/turmas/${turmaId}/relatorio-notas`);
    return res.data;
  };

  const gerarPdf = async () => {
    if (!turmaId || aGerar) return;
    // abrir a janela já no clique — senão o navegador bloqueia o pop-up
    const janela = abrirJanelaRelatorio();
    if (!janela) {
      onErro?.('O navegador bloqueou a janela do relatório. Permita pop-ups para este site e tente de novo.');
      return;
    }
    setAGerar('pdf');
    try {
      const dados = await buscar();
      imprimirRelatorio(janela, dados, { geradoPor });
      onSucesso?.('Relatório pronto. Na janela de impressão, escolha "Guardar como PDF".');
    } catch (e) {
      janela.close();
      onErro?.(e.response?.data?.message || 'Não foi possível gerar o relatório.');
    } finally {
      setAGerar(null);
    }
  };

  const gerarExcel = async () => {
    if (!turmaId || aGerar) return;
    setAGerar('excel');
    try {
      const dados = await buscar();
      descarregarCsv(dados);
      onSucesso?.('Ficheiro descarregado. Abra-o no Excel.');
    } catch (e) {
      onErro?.(e.response?.data?.message || 'Não foi possível exportar as notas.');
    } finally {
      setAGerar(null);
    }
  };

  return (
    <div className="relatorio-acoes">
      <Button
        variant="primary"
        icon={<Printer size={16} />}
        onClick={gerarPdf}
        loading={aGerar === 'pdf'}
        disabled={!turmaId || !!aGerar}
      >
        Relatório (PDF)
      </Button>
      <Button
        variant="outline"
        icon={<FileSpreadsheet size={16} />}
        onClick={gerarExcel}
        loading={aGerar === 'excel'}
        disabled={!turmaId || !!aGerar}
      >
        Exportar Excel
      </Button>
    </div>
  );
}