import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Rastreamento, VelocidadeReproducao } from '../types';

const DURACAO_PASSO_MS = 1500;

function limitarIndice(indice: number, maximo: number) {
  return Math.min(Math.max(indice, 0), maximo);
}

export function useLinhaDoTempoExecucao(rastreamento: Rastreamento | null) {
  const [indicePasso, definirIndicePasso] = useState(0);
  const [reproduzindo, definirReproduzindo] = useState(false);
  const [velocidade, definirVelocidade] = useState<VelocidadeReproducao>(1);
  const [chaveAnimacao, definirChaveAnimacao] = useState(0);
  const [emTransicao, definirEmTransicao] = useState(false);
  const temporizadorTransicaoRef = useRef<number | null>(null);

  const indiceMaximo = Math.max(0, (rastreamento?.steps.length ?? 1) - 1);

  useEffect(() => {
    definirIndicePasso(0);
    definirReproduzindo(false);
    definirChaveAnimacao(0);
    definirEmTransicao(false);
  }, [rastreamento?.id]);

  useEffect(() => {
    if (temporizadorTransicaoRef.current) {
      window.clearTimeout(temporizadorTransicaoRef.current);
    }

    definirChaveAnimacao((valorAtual) => valorAtual + 1);
    definirEmTransicao(true);
    temporizadorTransicaoRef.current = window.setTimeout(() => {
      definirEmTransicao(false);
    }, DURACAO_PASSO_MS / velocidade);

    return () => {
      if (temporizadorTransicaoRef.current) {
        window.clearTimeout(temporizadorTransicaoRef.current);
      }
    };
  }, [indicePasso, velocidade]);

  useEffect(() => {
    if (!reproduzindo || !rastreamento) {
      return undefined;
    }

    const temporizador = window.setInterval(() => {
      definirIndicePasso((indiceAtual) => {
        if (indiceAtual >= indiceMaximo) {
          definirReproduzindo(false);
          return indiceAtual;
        }

        return indiceAtual + 1;
      });
    }, DURACAO_PASSO_MS / velocidade);

    return () => window.clearInterval(temporizador);
  }, [indiceMaximo, reproduzindo, rastreamento, velocidade]);

  const irParaPasso = useCallback(
    (proximoIndice: number) => {
      definirIndicePasso(limitarIndice(proximoIndice, indiceMaximo));
    },
    [indiceMaximo],
  );

  const avancar = useCallback(() => {
    definirIndicePasso((indiceAtual) => limitarIndice(indiceAtual + 1, indiceMaximo));
  }, [indiceMaximo]);

  const voltar = useCallback(() => {
    definirIndicePasso((indiceAtual) => limitarIndice(indiceAtual - 1, indiceMaximo));
  }, [indiceMaximo]);

  const reiniciar = useCallback(() => {
    definirIndicePasso(0);
    definirReproduzindo(false);
  }, []);

  const progressoLinhaDoTempo = useMemo(() => {
    if (!rastreamento || rastreamento.steps.length <= 1) {
      return 0;
    }

    return indicePasso / (rastreamento.steps.length - 1);
  }, [indicePasso, rastreamento]);

  return {
    indicePasso,
    definirIndicePasso: irParaPasso,
    reproduzindo,
    definirReproduzindo,
    velocidade,
    definirVelocidade,
    chaveAnimacao,
    emTransicao,
    avancar,
    voltar,
    reiniciar,
    progressoLinhaDoTempo,
    indiceMaximo,
  };
}
