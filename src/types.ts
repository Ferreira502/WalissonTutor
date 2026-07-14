export type Language = 'c' | 'cpp' | 'java';

export type PlaybackSpeed = 0.5 | 1 | 2 | 4;

export interface Variable {
  name: string;
  type: string;
  value: string | number;
  address?: string;
  reference?: string;
  changed?: boolean;
}

export interface HeapItem {
  address: string;
  type: string;
  values?: Array<string | number>;
  elementAddresses?: string[];
  elementType?: string;
  fields?: Record<string, string | number>;
  freed?: boolean;
}

export interface StackFrame {
  name: string;
  variables: Variable[];
}

export interface Step {
  line: number;
  event: string;
  explanation: string;
  stack: StackFrame[];
  heap: HeapItem[];
  stdout: string;
}

export interface Trace {
  id: string;
  language: Language;
  steps: Step[];
  executionTimeMs: number;
  cached?: boolean;
}

export interface StepDiff {
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
