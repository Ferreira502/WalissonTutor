import { MarkerType, type Edge, type Node } from '@xyflow/react';
import { defaultVisualizationPlugins, type MemoryGraphResult } from './plugins';
import type { HeapItem, Language, StackFrame, Step, StepDiff, Variable } from './types';

type StackNodeData = {
  frame: StackFrame;
  index: number;
  diff: StepDiff;
  previousFrame: StackFrame | null;
  animationKey: number;
};

type HeapNodeData = {
  item: HeapItem;
  language: Language;
  diff: StepDiff;
  previousItem: HeapItem | null;
  animationKey: number;
};

type MemoryNodeData = StackNodeData | HeapNodeData;

function variableKey(frameName: string, variable: Variable) {
  return `${frameName}:${variable.name}:${variable.address ?? 'na'}`;
}

function variableMap(step: Step | null) {
  const map = new Map<string, Variable>();

  step?.stack.forEach((frame) => {
    frame.variables.forEach((variable) => {
      map.set(variableKey(frame.name, variable), variable);
    });
  });

  return map;
}

function heapMap(step: Step | null) {
  return new Map((step?.heap ?? []).map((item) => [item.address, item]));
}

function getNodeIdForAddress(step: Step, address: string) {
  const stackIndex = step.stack.findIndex((frame) => frame.variables.some((variable) => variable.address === address));
  if (stackIndex >= 0) {
    return `stack-${stackIndex}`;
  }

  const heapIndex = step.heap.findIndex((item) => item.address === address);
  if (heapIndex >= 0) {
    return `heap-${heapIndex}`;
  }

  return null;
}

function buildNarrative(previousStep: Step | null, currentStep: Step, diff: Omit<StepDiff, 'narrative' | 'focusNodeIds' | 'currentLineLabel'>) {
  const messages: string[] = [];
  const previousVariables = variableMap(previousStep);
  const currentVariables = variableMap(currentStep);
  const previousHeap = heapMap(previousStep);
  const currentHeap = heapMap(currentStep);

  diff.addedVariableKeys.forEach((key) => {
    const variable = currentVariables.get(key);
    if (variable) {
      messages.push(`${variable.name} surgiu na stack com valor ${String(variable.value)}.`);
    }
  });

  diff.changedVariableKeys.forEach((key) => {
    const previousVariable = previousVariables.get(key);
    const currentVariable = currentVariables.get(key);
    if (previousVariable && currentVariable) {
      messages.push(`${currentVariable.name} mudou de ${String(previousVariable.value)} para ${String(currentVariable.value)}.`);
    }
  });

  diff.addedHeapAddresses.forEach((address) => {
    const item = currentHeap.get(address);
    if (item) {
      messages.push(`${item.type} foi alocado na heap em ${address}.`);
    }
  });

  diff.freedHeapAddresses.forEach((address) => {
    messages.push(`A alocação ${address} foi marcada como liberada.`);
  });

  diff.changedHeapAddresses.forEach((address) => {
    const previousItem = previousHeap.get(address);
    const currentItem = currentHeap.get(address);
    if (previousItem && currentItem && JSON.stringify(previousItem.values) !== JSON.stringify(currentItem.values)) {
      messages.push(`Os dados em ${address} foram atualizados.`);
    }
  });

  if (diff.referenceEdges.length > 0) {
    messages.push('Uma referência foi animada para mostrar o destino do ponteiro.');
  }

  if (diff.stdoutDelta) {
    messages.push(`A saída padrão recebeu "${diff.stdoutDelta.trim()}".`);
  }

  if (!messages.length) {
    messages.push(currentStep.explanation);
  }

  return messages;
}

export function buildStepDiff(previousStep: Step | null, currentStep: Step): StepDiff {
  const previousVariables = variableMap(previousStep);
  const currentVariables = variableMap(currentStep);
  const previousHeap = heapMap(previousStep);
  const currentHeap = heapMap(currentStep);

  const addedVariableKeys: string[] = [];
  const changedVariableKeys: string[] = [];
  const removedVariableKeys: string[] = [];
  const addedHeapAddresses: string[] = [];
  const changedHeapAddresses: string[] = [];
  const freedHeapAddresses: string[] = [];
  const referenceEdges: string[] = [];
  const focusAddresses = new Set<string>();

  currentStep.stack.forEach((frame, frameIndex) => {
    frame.variables.forEach((variable) => {
      const key = variableKey(frame.name, variable);
      const previousVariable = previousVariables.get(key);

      if (!previousVariable) {
        addedVariableKeys.push(key);
      } else if (
        previousVariable.value !== variable.value ||
        previousVariable.reference !== variable.reference ||
        previousVariable.type !== variable.type
      ) {
        changedVariableKeys.push(key);
      }

      if (variable.reference) {
        const edgeId = `edge-${frameIndex}-${variable.name}-${variable.reference}`;

        if (variable.changed || previousVariable?.reference !== variable.reference) {
          referenceEdges.push(edgeId);
          focusAddresses.add(variable.reference);
        }
      }

      if (variable.address && (variable.changed || !previousVariable)) {
        focusAddresses.add(variable.address);
      }
    });
  });

  previousVariables.forEach((_variable, key) => {
    if (!currentVariables.has(key)) {
      removedVariableKeys.push(key);
    }
  });

  currentStep.heap.forEach((item) => {
    const previousItem = previousHeap.get(item.address);

    if (!previousItem) {
      addedHeapAddresses.push(item.address);
      focusAddresses.add(item.address);
      return;
    }

    if (JSON.stringify(previousItem.values) !== JSON.stringify(item.values) || JSON.stringify(previousItem.fields) !== JSON.stringify(item.fields)) {
      changedHeapAddresses.push(item.address);
      focusAddresses.add(item.address);
    }

    if (!previousItem.freed && item.freed) {
      freedHeapAddresses.push(item.address);
      focusAddresses.add(item.address);
    }
  });

  const stdoutDelta = previousStep && currentStep.stdout.startsWith(previousStep.stdout)
    ? currentStep.stdout.slice(previousStep.stdout.length)
    : currentStep.stdout;

  const partialDiff = {
    addedVariableKeys,
    changedVariableKeys,
    removedVariableKeys,
    addedHeapAddresses,
    changedHeapAddresses,
    freedHeapAddresses,
    referenceEdges,
    focusAddresses: [...focusAddresses],
    stdoutDelta,
  };

  return {
    ...partialDiff,
    focusNodeIds: [...focusAddresses].map((address) => getNodeIdForAddress(currentStep, address)).filter(Boolean) as string[],
    narrative: buildNarrative(previousStep, currentStep, partialDiff),
    currentLineLabel: `Linha ${currentStep.line} · ${currentStep.event}`,
  };
}

function itemIsFreed(address: string, heap: HeapItem[]) {
  return heap.some((item) => item.address === address && item.freed);
}

export function buildMemoryGraph({
  step,
  previousStep,
  language,
  diff,
  animationKey,
}: {
  step: Step;
  previousStep: Step | null;
  language: Language;
  diff: StepDiff;
  animationKey: number;
}) {
  const nodes: Node<MemoryNodeData>[] = [];
  const edges: Edge[] = [];
  const stackAddressMap = new Map<string, string>();
  const heapAddressMap = new Map<string, string>();
  const previousFrames = new Map((previousStep?.stack ?? []).map((frame) => [frame.name, frame]));
  const previousHeap = new Map((previousStep?.heap ?? []).map((item) => [item.address, item]));

  step.stack.forEach((frame, frameIndex) => {
    const nodeId = `stack-${frameIndex}`;
    const height = Math.max(170, 84 + frame.variables.length * 66);

    nodes.push({
      id: nodeId,
      type: 'stackFrame',
      position: { x: 30, y: 42 + frameIndex * (height + 28) },
      draggable: false,
      style: { width: 380, height },
      data: {
        frame,
        index: frameIndex,
        diff,
        previousFrame: previousFrames.get(frame.name) ?? null,
        animationKey,
      },
    });

    frame.variables.forEach((variable) => {
      if (variable.address) {
        stackAddressMap.set(variable.address, nodeId);
      }
    });
  });

  step.heap.forEach((item, heapIndex) => {
    const nodeId = `heap-${heapIndex}`;
    const bodySize = item.values ? Math.max(1, item.values.length) : Object.keys(item.fields ?? {}).length || 1;
    const height = item.values ? 162 + Math.ceil(bodySize / 4) * 26 : 132 + bodySize * 28;

    nodes.push({
      id: nodeId,
      type: 'heapBlock',
      position: { x: 490, y: 42 + heapIndex * (height + 28) },
      draggable: false,
      style: { width: item.values ? 340 : 310, height },
      data: {
        item,
        language,
        diff,
        previousItem: previousHeap.get(item.address) ?? null,
        animationKey,
      },
    });

    heapAddressMap.set(item.address, nodeId);
  });

  step.stack.forEach((frame, frameIndex) => {
    frame.variables.forEach((variable) => {
      if (!variable.reference) {
        return;
      }

      const targetNodeId = stackAddressMap.get(variable.reference) ?? heapAddressMap.get(variable.reference);
      if (!targetNodeId) {
        return;
      }

      const edgeId = `edge-${frameIndex}-${variable.name}-${variable.reference}`;
      const isHighlighted = diff.referenceEdges.includes(edgeId);

      edges.push({
        id: edgeId,
        source: `stack-${frameIndex}`,
        sourceHandle: `ref:${variable.name}:${variable.reference}`,
        target: targetNodeId,
        targetHandle: stackAddressMap.has(variable.reference) ? `stack:${variable.reference}` : `heap:${variable.reference}`,
        type: 'smoothstep',
        animated: isHighlighted,
        label: isHighlighted ? `${variable.name} -> ${variable.reference}` : undefined,
        labelStyle: {
          fill: '#b4c6dd',
          fontSize: 11,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#53c8ff' },
        style: {
          stroke: itemIsFreed(variable.reference, step.heap) ? '#ff8ca1' : isHighlighted ? '#6ee7ff' : '#53c8ff',
          strokeWidth: isHighlighted ? 3 : 2,
          strokeDasharray: isHighlighted ? '7 5' : undefined,
        },
      });
    });
  });

  let graph: MemoryGraphResult = { nodes, edges };

  for (const plugin of defaultVisualizationPlugins) {
    if (plugin.decorate) {
      graph = plugin.decorate({ graph, step, previousStep, diff, language });
    }
  }

  const pluginMessages = defaultVisualizationPlugins.flatMap((plugin) =>
    plugin.describe ? plugin.describe({ graph, step, previousStep, diff, language }) : [],
  );

  return {
    ...graph,
    pluginMessages,
  };
}
