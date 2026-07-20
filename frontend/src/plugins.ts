import type { Edge, Node } from '@xyflow/react';
import type { DiferencaPasso, Linguagem, Passo } from './types';

export interface ResultadoGrafoMemoria {
  nodes: Node[];
  edges: Edge[];
}

export interface ContextoPluginVisualizacao {
  graph: ResultadoGrafoMemoria;
  step: Passo;
  previousStep: Passo | null;
  diff: DiferencaPasso;
  language: Linguagem;
}

export interface PluginVisualizacao {
  id: string;
  decorate?(context: ContextoPluginVisualizacao): ResultadoGrafoMemoria;
  describe?(context: ContextoPluginVisualizacao): string[];
}

const pluginPulsoPonteiro: PluginVisualizacao = {
  id: 'pointer-pulse',
  decorate: ({ diff, graph }) => ({
    ...graph,
    edges: graph.edges.map((edge) =>
      diff.referenceEdges.includes(edge.id)
        ? {
            ...edge,
            animated: true,
            style: {
              ...edge.style,
              strokeWidth: 3,
              stroke: '#6ee7ff',
            },
          }
        : edge,
    ),
  }),
  describe: ({ diff }) =>
    diff.referenceEdges.length > 0 ? ['Seta de referencia destacada para mostrar o fluxo do ponteiro.'] : [],
};

const pluginSaidaPadrao: PluginVisualizacao = {
  id: 'stdout-glow',
  describe: ({ diff }) => (diff.stdoutDelta ? [`Saida gerada neste passo: ${diff.stdoutDelta.trim()}`] : []),
};

export const pluginsPadraoVisualizacao: PluginVisualizacao[] = [pluginPulsoPonteiro, pluginSaidaPadrao];
