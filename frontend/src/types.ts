export type Linguagem = 'c' | 'cpp' | 'java';

export type VelocidadeReproducao = 0.5 | 1 | 2 | 4;

export interface Variavel {
  name: string;
  type: string;
  value: string | number;
  address?: string;
  reference?: string;
  changed?: boolean;
}

export interface ItemHeap {
  address: string;
  type: string;
  values?: Array<string | number>;
  elementAddresses?: string[];
  elementType?: string;
  fields?: Record<string, string | number>;
  freed?: boolean;
}

export interface QuadroPilha {
  name: string;
  variables: Variavel[];
}

export interface Passo {
  line: number;
  event: string;
  explanation: string;
  stack: QuadroPilha[];
  heap: ItemHeap[];
  stdout: string;
}

export interface Rastreamento {
  id: string;
  language: Linguagem;
  steps: Passo[];
  executionTimeMs: number;
  cached?: boolean;
}

export interface DiferencaPasso {
  addedVariableKeys: string[];
  changedVariableKeys: string[];
  removedVariableKeys: string[];
  addedHeapAddresses: string[];
  changedHeapAddresses: string[];
  freedHeapAddresses: string[];
  referenceEdges: string[];
  focusAddresses: string[];
  focusNodeIds: string[];
  stdoutDelta: string;
  narrative: string[];
  currentLineLabel: string;
}
