import React from 'react';
import {
  render,
  screen,
  waitFor,
  cleanup,
  act,
} from '@testing-library/react';

import { ChatArea } from './Mensagens';
import api from '../services/api';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('ChatArea — isolamento de respostas obsoletas', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  test(
    'resposta antiga não substitui a conversa atualmente selecionada',
    async () => {
      let resolverJoao;
      let resolverMaria;

      api.get.mockImplementation((url) => {
        if (url.includes('/mensagens/conversa/1')) {
          return new Promise((resolve) => {
            resolverJoao = resolve;
          });
        }

        if (url.includes('/mensagens/conversa/2')) {
          return new Promise((resolve) => {
            resolverMaria = resolve;
          });
        }

        return Promise.reject(
          new Error(`URL inesperada: ${url}`)
        );
      });

      const { rerender } = render(
        <ChatArea
          destinatarioId={1}
          destinatarioNome="João"
          currentUserId={99}
        />
      );

      // O primeiro pedido deve ser o de João.
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          '/mensagens/conversa/1',
          expect.objectContaining({
            signal: expect.any(AbortSignal),
          })
        );
      });

      // Trocar para Maria antes de João responder.
      rerender(
        <ChatArea
          destinatarioId={2}
          destinatarioNome="Maria"
          currentUserId={99}
        />
      );

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          '/mensagens/conversa/2',
          expect.objectContaining({
            signal: expect.any(AbortSignal),
          })
        );
      });

      // Maria responde primeiro.
      await act(async () => {
        resolverMaria({
          data: [
            {
              id: 2,
              remetente_id: 2,
              mensagem: 'Mensagem da Maria',
              criado_em: '2026-08-19T12:00:00Z',
            },
          ],
        });
      });

      // A conversa de Maria deve aparecer.
      await waitFor(() => {
        expect(
          screen.getByText('Mensagem da Maria')
        ).toBeInTheDocument();
      });

      // João responde atrasado.
      await act(async () => {
        resolverJoao({
          data: [
            {
              id: 1,
              remetente_id: 1,
              mensagem: 'Mensagem atrasada do João',
              criado_em: '2026-08-19T11:00:00Z',
            },
          ],
        });
      });

      // A resposta antiga NÃO pode substituir Maria.
      await waitFor(() => {
        expect(
          screen.getByText('Mensagem da Maria')
        ).toBeInTheDocument();

        expect(
          screen.queryByText('Mensagem atrasada do João')
        ).not.toBeInTheDocument();
      });

      expect(
        screen.getByText('Conversa com Maria')
      ).toBeInTheDocument();
    }
  );

  test(
    'trocar de conversa aborta a request anterior',
    async () => {
      let signalJoao;

      api.get.mockImplementation((url, config = {}) => {
        if (url.includes('/mensagens/conversa/1')) {
          signalJoao = config.signal;

          return new Promise(() => {});
        }

        if (url.includes('/mensagens/conversa/2')) {
          return Promise.resolve({
            data: [],
          });
        }

        return Promise.reject(
          new Error(`URL inesperada: ${url}`)
        );
      });

      const { rerender } = render(
        <ChatArea
          destinatarioId={1}
          destinatarioNome="João"
          currentUserId={99}
        />
      );

      await waitFor(() => {
        expect(signalJoao).toBeTruthy();
      });

      expect(signalJoao.aborted).toBe(false);

      rerender(
        <ChatArea
          destinatarioId={2}
          destinatarioNome="Maria"
          currentUserId={99}
        />
      );

      await waitFor(() => {
        expect(signalJoao.aborted).toBe(true);
      });

      expect(
        screen.getByText('Conversa com Maria')
      ).toBeInTheDocument();
    }
  );
});