import type { Edge, Node } from '@xyflow/react';
import type { Language, Step, StepDiff } from './types';

export interface MemoryGraphResult {
  nodes: Node[];
  edges: Edge[];
}

export interface VisualizationPluginContext {
  graph: MemoryGraphResult;
  step: Step;
  previousStep: Step | null;
  diff: StepDiff;
  language: Language;
}

export interface VisualizationPlugin {
  id: string;
  decorate?(context: VisualizationPluginContext): MemoryGraphResult;
  describe?(context: VisualizationPluginContext): string[];
}

const pointerPulsePlugin: VisualizationPlugin = {
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

const stdoutPlugin: VisualizationPlugin = {
  id: 'stdout-glow',
  describe: ({ diff }) => (diff.stdoutDelta ? [`Saida gerada neste passo: ${diff.stdoutDelta.trim()}`] : []),
};

export const defaultVisualizationPlugins: VisualizationPlugin[] = [pointerPulsePlugin, stdoutPlugin];
