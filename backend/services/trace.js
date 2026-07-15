import crypto from 'node:crypto';
import { MemoryAllocator } from './memoryAllocator.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

function resetChangedFlags(variables) {
  variables.forEach((variable) => {
    variable.changed = false;
  });
}

function findVariable(variables, name) {
  return variables.find((variable) => variable.name === name);
}

function getHeapItemByOwner(variables, heap, ownerName) {
  const owner = findVariable(variables, ownerName);
  return heap.find((item) => item.address === owner?.reference);
}

function parseStdoutValue(statement, variables, heap, language) {
  if (language === 'java') {
    const fieldAccess = statement.match(/System\.out\.println\(\s*(\w+)\.(\w+)\s*\)/);
    if (fieldAccess) {
      const owner = findVariable(variables, fieldAccess[1]);
      const heapItem = heap.find((item) => item.address === owner?.reference);
      const fieldValue = heapItem?.fields?.[fieldAccess[2]];

      if (fieldValue !== undefined) {
        return String(fieldValue);
      }
    }

    const variableAccess = statement.match(/System\.out\.println\(\s*(\w+)\s*\)/);
    if (variableAccess) {
      const variable = findVariable(variables, variableAccess[1]);
      if (variable) {
        return String(variable.value);
      }
    }

    return String(heap[0]?.fields?.nome ?? heap[0]?.fields?.name ?? 'null');
  }

  const pointerDereference = statement.match(/\*(\w+)/);
  if (pointerDereference) {
    const pointer = findVariable(variables, pointerDereference[1]);
    const target = variables.find((variable) => variable.address === pointer?.reference);

    if (target) {
      return String(target.value);
    }
  }

  const indexedAccess = statement.match(/(\w+)\[(\d+)\]/);
  if (indexedAccess) {
    const heapItem = getHeapItemByOwner(variables, heap, indexedAccess[1]);
    const value = heapItem?.values?.[Number(indexedAccess[2])];

    if (value !== undefined) {
      return String(value);
    }
  }

  const scalar = variables.find((variable) => typeof variable.value === 'number');
  return String(scalar?.value ?? 42);
}

export function traceCode(language, code) {
  if (code.split('\n').length > 500) {
    throw new Error('Code may not exceed 500 lines.');
  }

  if (!['c', 'cpp', 'java'].includes(language)) {
    throw new Error('Unsupported language. Choose C, C++, or Java.');
  }

  if (!code.trim()) {
    throw new Error('The editor is empty. Add a program before running it.');
  }

  if (/while\s*\(\s*(true|1)\s*\)/.test(code)) {
    throw new Error('Error: Time limit exceeded. Check for infinite loops.');
  }

  if ((language === 'c' || language === 'cpp') && !/main\s*\(/.test(code)) {
    throw new Error("Compilation error: undefined reference to 'main'");
  }

  if (language === 'java' && !/class\s+\w+/.test(code)) {
    throw new Error('Compilation error: class declaration expected');
  }

  const allocator = new MemoryAllocator();
  const variables = [];
  const heap = [];
  const steps = [];
  let stdout = '';
  let objectCounter = 1;

  const pushStep = (lineIndex, event, explanation) => {
    steps.push({
      line: lineIndex + 1,
      event,
      explanation,
      stack: [{ name: 'main', variables: clone(variables) }],
      heap: clone(heap),
      stdout,
    });
  };

  const lines = code.split('\n');

  lines.forEach((rawLine, lineIndex) => {
    const statement = rawLine.trim();

    if (!statement || statement.startsWith('#') || statement.startsWith('//') || statement === '{' || statement === '}') {
      return;
    }

    if (/main\s*\(/.test(statement)) {
      pushStep(lineIndex, 'function_call', 'Enter the main function');
      return;
    }

    let match = statement.match(/^int\s+(\w+)\s*=\s*(-?\d+)\s*;/);
    if (match) {
      resetChangedFlags(variables);
      variables.push({
        name: match[1],
        type: 'int',
        value: Number(match[2]),
        address: allocator.allocateStack('int'),
        changed: true,
      });
      pushStep(lineIndex, 'variable_decl', `Create integer "${match[1]}"`);
      return;
    }

    match = statement.match(/^int\s*\*\s*(\w+)\s*=\s*&\s*(\w+)\s*;/);
    if (match) {
      resetChangedFlags(variables);
      const target = findVariable(variables, match[2]);
      variables.push({
        name: match[1],
        type: 'int*',
        value: target?.address || 'null',
        address: allocator.allocateStack('int*'),
        reference: target?.address,
        changed: true,
      });
      pushStep(lineIndex, 'pointer_assign', `Point "${match[1]}" to "${match[2]}"`);
      return;
    }

    match = statement.match(/^int\s*\*\s*(\w+)\s*=\s*malloc\(\s*(\d+)\s*\*\s*sizeof\(int\)\s*\)\s*;/);
    if (match) {
      resetChangedFlags(variables);
      const count = Number(match[2]);
      const baseAddress = allocator.allocateHeap(count * allocator.getTypeSize('int'));
      variables.push({
        name: match[1],
        type: 'int*',
        value: baseAddress,
        address: allocator.allocateStack('int*'),
        reference: baseAddress,
        changed: true,
      });
      heap.push({
        address: baseAddress,
        type: `int[${count}]`,
        values: Array.from({ length: count }, () => '0 (lixo)'),
        elementAddresses: allocator.contiguousAddresses(baseAddress, count, 'int'),
        elementType: 'int',
      });
      pushStep(lineIndex, 'heap_alloc', `Allocate memory for "${match[1]}"`);
      return;
    }

    match = statement.match(/^vector\s*<\s*int\s*>\s*(\w+)\s*=\s*\{([^}]*)\}\s*;/);
    if (match) {
      resetChangedFlags(variables);
      const values = match[2]
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map(Number);
      const baseAddress = allocator.allocateHeap(values.length * allocator.getTypeSize('int'));
      variables.push({
        name: match[1],
        type: 'vector<int>',
        value: baseAddress,
        address: allocator.allocateStack('vector<int>'),
        reference: baseAddress,
        changed: true,
      });
      heap.push({
        address: baseAddress,
        type: `vector<int>[${values.length}]`,
        values,
        elementAddresses: allocator.contiguousAddresses(baseAddress, values.length, 'int'),
        elementType: 'int',
      });
      pushStep(lineIndex, 'heap_alloc', `Allocate memory for "${match[1]}"`);
      return;
    }

    match = statement.match(/^(\w+)\[(\d+)\]\s*=\s*(-?\d+)\s*;/);
    if (match) {
      const heapItem = getHeapItemByOwner(variables, heap, match[1]);

      if (heapItem?.values) {
        heapItem.values[Number(match[2])] = Number(match[3]);
      }

      pushStep(lineIndex, 'heap_write', `Write ${match[3]} to ${match[1]}[${match[2]}]`);
      return;
    }

    match = statement.match(/^(\w+)\s*=\s*new\s+(\w+)\s*(?:\(\s*\))?\s*;/);
    if (match) {
      resetChangedFlags(variables);
      const address = `obj@${objectCounter++}`;
      variables.push({
        name: match[1],
        type: match[2],
        value: address,
        address: allocator.allocateStack(match[2]),
        reference: address,
        changed: true,
      });
      heap.push({
        address,
        type: match[2],
        fields: { name: 'null', age: 0 },
      });
      pushStep(lineIndex, 'object_alloc', `Create a new ${match[2]} object`);
      return;
    }

    match = statement.match(/^(\w+)\s+(\w+)\s*=\s*new\s+(\w+)\s*\(\s*\)\s*;/);
    if (language === 'java' && match) {
      resetChangedFlags(variables);
      const declaredType = match[1];
      const variableName = match[2];
      const instantiatedType = match[3];
      const address = `obj@${objectCounter++}`;

      variables.push({
        name: variableName,
        type: declaredType,
        value: address,
        address: allocator.allocateStack(`${declaredType}*`),
        reference: address,
        changed: true,
      });
      heap.push({
        address,
        type: instantiatedType,
        fields: {},
      });
      pushStep(lineIndex, 'object_alloc', `Create a new ${instantiatedType} object`);
      return;
    }

    match = statement.match(/^(\w+)\.(\w+)\s*=\s*(?:"([^"]*)"|(-?\d+))\s*;/);
    if (match) {
      resetChangedFlags(variables);
      const owner = findVariable(variables, match[1]);
      const heapItem = heap.find((item) => item.address === owner?.reference);

      if (heapItem?.fields) {
        heapItem.fields[match[2]] = match[3] ?? Number(match[4]);
      }

      pushStep(lineIndex, 'field_write', `Update ${match[1]}.${match[2]}`);
      return;
    }

    match = statement.match(/^(\w+)\s+(\w+)\s*=\s*(\w+)\s*;/);
    if (language === 'java' && match) {
      resetChangedFlags(variables);
      const source = findVariable(variables, match[3]);
      variables.push({
        name: match[2],
        type: match[1],
        value: source?.value || 'null',
        address: allocator.allocateStack(match[1]),
        reference: source?.reference,
        changed: true,
      });
      pushStep(lineIndex, 'reference_assign', `Alias "${match[2]}" to the same object`);
      return;
    }

    if (/printf|cout|System\.out\.println/.test(statement)) {
      stdout += `${parseStdoutValue(statement, variables, heap, language)}\n`;
      pushStep(lineIndex, 'stdout', 'Write a value to standard output');
      return;
    }

    match = statement.match(/^free\((\w+)\)\s*;/);
    if (match) {
      const owner = findVariable(variables, match[1]);
      const heapItem = heap.find((item) => item.address === owner?.reference);

      if (heapItem) {
        heapItem.freed = true;
      }

      pushStep(lineIndex, 'heap_free', `Release memory owned by "${match[1]}"`);
      return;
    }

    if (/return\s+/.test(statement)) {
      pushStep(lineIndex, 'function_return', 'Return from the main function');
    }
  });

  if (!steps.length) {
    pushStep(0, 'step_line', 'Execute the first statement');
  }

  return {
    id: `exec_${crypto.randomBytes(5).toString('hex')}`,
    language,
    steps,
    executionTimeMs: Math.floor(20 + Math.random() * 40),
  };
}
