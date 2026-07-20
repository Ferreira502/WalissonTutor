import { MarkerType, type Edge, type Node } from '@xyflow/react';
import { pluginsPadraoVisualizacao, type ResultadoGrafoMemoria } from './plugins';
import type { DiferencaPasso, ItemHeap, Linguagem, Passo, QuadroPilha, Variavel } from './types';

type DadosNoPilha = {
  quadro: QuadroPilha;
  indice: number;
  diferenca: DiferencaPasso;
  quadroAnterior: QuadroPilha | null;
  chaveAnimacao: number;
};

type DadosNoHeap = {
  item: ItemHeap;
  linguagem: Linguagem;
  diferenca: DiferencaPasso;
  itemAnterior: ItemHeap | null;
  chaveAnimacao: number;
};

type DadosNoMemoria = DadosNoPilha | DadosNoHeap;

function chaveVariavel(nomeQuadro: string, variavel: Variavel) {
  return `${nomeQuadro}:${variavel.name}:${variavel.address ?? 'na'}`;
}

function mapaVariaveis(passo: Passo | null) {
  const mapa = new Map<string, Variavel>();

  passo?.stack.forEach((quadro) => {
    quadro.variables.forEach((variavel) => {
      mapa.set(chaveVariavel(quadro.name, variavel), variavel);
    });
  });

  return mapa;
}

function mapaHeap(passo: Passo | null) {
  return new Map((passo?.heap ?? []).map((item) => [item.address, item]));
}

function obterIdNoPorEndereco(passo: Passo, endereco: string) {
  const indicePilha = passo.stack.findIndex((quadro) =>
    quadro.variables.some((variavel) => variavel.address === endereco),
  );

  if (indicePilha >= 0) {
    return `stack-${indicePilha}`;
  }

  const indiceHeap = passo.heap.findIndex((item) => item.address === endereco);
  if (indiceHeap >= 0) {
    return `heap-${indiceHeap}`;
  }

  return null;
}

function construirNarrativa(
  passoAnterior: Passo | null,
  passoAtual: Passo,
  diferenca: Omit<DiferencaPasso, 'narrative' | 'focusNodeIds' | 'currentLineLabel'>,
) {
  const mensagens: string[] = [];
  const variaveisAnteriores = mapaVariaveis(passoAnterior);
  const variaveisAtuais = mapaVariaveis(passoAtual);
  const heapAnterior = mapaHeap(passoAnterior);
  const heapAtual = mapaHeap(passoAtual);

  diferenca.addedVariableKeys.forEach((chave) => {
    const variavel = variaveisAtuais.get(chave);
    if (variavel) {
      mensagens.push(`${variavel.name} surgiu na stack com valor ${String(variavel.value)}.`);
    }
  });

  diferenca.changedVariableKeys.forEach((chave) => {
    const variavelAnterior = variaveisAnteriores.get(chave);
    const variavelAtual = variaveisAtuais.get(chave);

    if (variavelAnterior && variavelAtual) {
      mensagens.push(
        `${variavelAtual.name} mudou de ${String(variavelAnterior.value)} para ${String(variavelAtual.value)}.`,
      );
    }
  });

  diferenca.addedHeapAddresses.forEach((endereco) => {
    const item = heapAtual.get(endereco);
    if (item) {
      mensagens.push(`${item.type} foi alocado na heap em ${endereco}.`);
    }
  });

  diferenca.freedHeapAddresses.forEach((endereco) => {
    mensagens.push(`A alocacao ${endereco} foi marcada como liberada.`);
  });

  diferenca.changedHeapAddresses.forEach((endereco) => {
    const itemAnterior = heapAnterior.get(endereco);
    const itemAtual = heapAtual.get(endereco);

    if (itemAnterior && itemAtual && JSON.stringify(itemAnterior.values) !== JSON.stringify(itemAtual.values)) {
      mensagens.push(`Os dados em ${endereco} foram atualizados.`);
    }
  });

  if (diferenca.referenceEdges.length > 0) {
    mensagens.push('Uma referencia foi animada para mostrar o destino do ponteiro.');
  }

  if (diferenca.stdoutDelta) {
    mensagens.push(`A saida padrao recebeu "${diferenca.stdoutDelta.trim()}".`);
  }

  if (!mensagens.length) {
    mensagens.push(passoAtual.explanation);
  }

  return mensagens;
}

export function construirDiferencaPasso(passoAnterior: Passo | null, passoAtual: Passo): DiferencaPasso {
  const variaveisAnteriores = mapaVariaveis(passoAnterior);
  const variaveisAtuais = mapaVariaveis(passoAtual);
  const heapAnterior = mapaHeap(passoAnterior);

  const chavesVariaveisAdicionadas: string[] = [];
  const chavesVariaveisAlteradas: string[] = [];
  const chavesVariaveisRemovidas: string[] = [];
  const enderecosHeapAdicionados: string[] = [];
  const enderecosHeapAlterados: string[] = [];
  const enderecosHeapLiberados: string[] = [];
  const arestasReferencia: string[] = [];
  const enderecosFoco = new Set<string>();

  passoAtual.stack.forEach((quadro, indiceQuadro) => {
    quadro.variables.forEach((variavel) => {
      const chave = chaveVariavel(quadro.name, variavel);
      const variavelAnterior = variaveisAnteriores.get(chave);

      if (!variavelAnterior) {
        chavesVariaveisAdicionadas.push(chave);
      } else if (
        variavelAnterior.value !== variavel.value ||
        variavelAnterior.reference !== variavel.reference ||
        variavelAnterior.type !== variavel.type
      ) {
        chavesVariaveisAlteradas.push(chave);
      }

      if (variavel.reference) {
        const idAresta = `edge-${indiceQuadro}-${variavel.name}-${variavel.reference}`;

        if (variavel.changed || variavelAnterior?.reference !== variavel.reference) {
          arestasReferencia.push(idAresta);
          enderecosFoco.add(variavel.reference);
        }
      }

      if (variavel.address && (variavel.changed || !variavelAnterior)) {
        enderecosFoco.add(variavel.address);
      }
    });
  });

  variaveisAnteriores.forEach((_variavel, chave) => {
    if (!variaveisAtuais.has(chave)) {
      chavesVariaveisRemovidas.push(chave);
    }
  });

  passoAtual.heap.forEach((item) => {
    const itemAnterior = heapAnterior.get(item.address);

    if (!itemAnterior) {
      enderecosHeapAdicionados.push(item.address);
      enderecosFoco.add(item.address);
      return;
    }

    if (
      JSON.stringify(itemAnterior.values) !== JSON.stringify(item.values) ||
      JSON.stringify(itemAnterior.fields) !== JSON.stringify(item.fields)
    ) {
      enderecosHeapAlterados.push(item.address);
      enderecosFoco.add(item.address);
    }

    if (!itemAnterior.freed && item.freed) {
      enderecosHeapLiberados.push(item.address);
      enderecosFoco.add(item.address);
    }
  });

  const deltaSaida =
    passoAnterior && passoAtual.stdout.startsWith(passoAnterior.stdout)
      ? passoAtual.stdout.slice(passoAnterior.stdout.length)
      : passoAtual.stdout;

  const diferencaParcial = {
    addedVariableKeys: chavesVariaveisAdicionadas,
    changedVariableKeys: chavesVariaveisAlteradas,
    removedVariableKeys: chavesVariaveisRemovidas,
    addedHeapAddresses: enderecosHeapAdicionados,
    changedHeapAddresses: enderecosHeapAlterados,
    freedHeapAddresses: enderecosHeapLiberados,
    referenceEdges: arestasReferencia,
    focusAddresses: [...enderecosFoco],
    stdoutDelta: deltaSaida,
  };

  return {
    ...diferencaParcial,
    focusNodeIds: [...enderecosFoco]
      .map((endereco) => obterIdNoPorEndereco(passoAtual, endereco))
      .filter(Boolean) as string[],
    narrative: construirNarrativa(passoAnterior, passoAtual, diferencaParcial),
    currentLineLabel: `Linha ${passoAtual.line} · ${passoAtual.event}`,
  };
}

function itemFoiLiberado(endereco: string, heap: ItemHeap[]) {
  return heap.some((item) => item.address === endereco && item.freed);
}

export function construirGrafoMemoria({
  passo,
  passoAnterior,
  linguagem,
  diferenca,
  chaveAnimacao,
}: {
  passo: Passo;
  passoAnterior: Passo | null;
  linguagem: Linguagem;
  diferenca: DiferencaPasso;
  chaveAnimacao: number;
}) {
  const nos: Node<DadosNoMemoria>[] = [];
  const arestas: Edge[] = [];
  const mapaEnderecosPilha = new Map<string, string>();
  const mapaEnderecosHeap = new Map<string, string>();
  const quadrosAnteriores = new Map((passoAnterior?.stack ?? []).map((quadro) => [quadro.name, quadro]));
  const heapAnterior = new Map((passoAnterior?.heap ?? []).map((item) => [item.address, item]));

  passo.stack.forEach((quadro, indiceQuadro) => {
    const idNo = `stack-${indiceQuadro}`;
    const altura = Math.max(118, 62 + quadro.variables.length * 54);

    nos.push({
      id: idNo,
      type: 'stackFrame',
      position: { x: 28, y: 34 + indiceQuadro * (altura + 24) },
      draggable: false,
      style: { width: 336, height: altura, zIndex: 2 },
      data: {
        quadro,
        indice: indiceQuadro,
        diferenca,
        quadroAnterior: quadrosAnteriores.get(quadro.name) ?? null,
        chaveAnimacao,
      },
    });

    quadro.variables.forEach((variavel) => {
      if (variavel.address) {
        mapaEnderecosPilha.set(variavel.address, idNo);
      }
    });
  });

  passo.heap.forEach((item, indiceHeap) => {
    const idNo = `heap-${indiceHeap}`;
    const tamanhoCorpo = item.values ? Math.max(1, item.values.length) : Object.keys(item.fields ?? {}).length || 1;
    const altura = item.values ? 124 + Math.ceil(tamanhoCorpo / 4) * 24 : 102 + tamanhoCorpo * 24;

    nos.push({
      id: idNo,
      type: 'heapBlock',
      position: { x: 468, y: 34 + indiceHeap * (altura + 24) },
      draggable: false,
      style: { width: item.values ? 298 : 280, height: altura, zIndex: 2 },
      data: {
        item,
        linguagem,
        diferenca,
        itemAnterior: heapAnterior.get(item.address) ?? null,
        chaveAnimacao,
      },
    });

    mapaEnderecosHeap.set(item.address, idNo);
  });

  passo.stack.forEach((quadro, indiceQuadro) => {
    quadro.variables.forEach((variavel) => {
      if (!variavel.reference) {
        return;
      }

      const idNoDestino = mapaEnderecosPilha.get(variavel.reference) ?? mapaEnderecosHeap.get(variavel.reference);
      if (!idNoDestino) {
        return;
      }

      const idAresta = `edge-${indiceQuadro}-${variavel.name}-${variavel.reference}`;
      const estaDestacada = diferenca.referenceEdges.includes(idAresta);

      arestas.push({
        id: idAresta,
        source: `stack-${indiceQuadro}`,
        sourceHandle: `ref:${variavel.name}:${variavel.reference}`,
        target: idNoDestino,
        targetHandle: mapaEnderecosPilha.has(variavel.reference)
          ? `stack:${variavel.reference}`
          : `heap:${variavel.reference}`,
        type: 'step',
        animated: estaDestacada,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#53c8ff' },
        zIndex: 0,
        style: {
          stroke: itemFoiLiberado(variavel.reference, passo.heap)
            ? '#ff8ca1'
            : estaDestacada
              ? '#6ee7ff'
              : '#53c8ff',
          strokeWidth: estaDestacada ? 3 : 2,
          strokeDasharray: estaDestacada ? '7 5' : undefined,
        },
      });
    });
  });

  let grafo: ResultadoGrafoMemoria = { nodes: nos, edges: arestas };

  for (const plugin of pluginsPadraoVisualizacao) {
    if (plugin.decorate) {
      grafo = plugin.decorate({
        graph: grafo,
        step: passo,
        previousStep: passoAnterior,
        diff: diferenca,
        language: linguagem,
      });
    }
  }

  const mensagensPlugins = pluginsPadraoVisualizacao.flatMap((plugin) =>
    plugin.describe
      ? plugin.describe({
          graph: grafo,
          step: passo,
          previousStep: passoAnterior,
          diff: diferenca,
          language: linguagem,
        })
      : [],
  );

  return {
    ...grafo,
    pluginMessages: mensagensPlugins,
  };
}
