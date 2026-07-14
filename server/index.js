import cors from 'cors';
import crypto from 'node:crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';

const app = express();
const cache = new Map();

app.use(cors());
app.use(express.json({ limit: '256kb' }));
app.use(
  '/api/run',
  rateLimit({
    windowMs: 1000,
    limit: 2,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

const eventLabels = {
  function_call: 'chamada de funcao',
  variable_decl: 'declaracao de variavel',
  pointer_assign: 'atribuicao de ponteiro',
  heap_alloc: 'alocacao na heap',
  heap_write: 'escrita na heap',
  object_alloc: 'criacao de objeto',
  field_write: 'alteracao de campo',
  reference_assign: 'atribuicao de referencia',
  stdout: 'saida padrao',
  heap_free: 'liberacao de memoria',
  function_return: 'retorno da funcao',
  step_line: 'execucao da linha',
};

const clone = (value) => JSON.parse(JSON.stringify(value));

class MemoryAllocator {
  constructor() {
    this.stackBase = 0x7ffc1000;
    this.heapBase = 0x7ffc2000;
    this.stackOffset = 0;
    this.heapOffset = 0;
  }

  getTypeSize(type) {
    switch (type) {
      case 'char':
        return 1;
      case 'int':
        return 4;
      case 'float':
        return 4;
      case 'double':
        return 8;
      case 'int*':
      case 'char*':
      case 'void*':
      case 'vector<int>':
        return 8;
      default:
        return 8;
    }
  }

  getTypeAlignment(type) {
    return Math.min(this.getTypeSize(type), 8);
  }

  align(offset, alignment) {
    const remainder = offset % alignment;
    return remainder === 0 ? offset : offset + (alignment - remainder);
  }

  format(address) {
    return `0x${address.toString(16)}`;
  }

  allocateStack(type) {
    this.stackOffset = this.align(this.stackOffset, this.getTypeAlignment(type));
    const address = this.stackBase + this.stackOffset;
    this.stackOffset += this.getTypeSize(type);
    return this.format(address);
  }

  allocateHeap(byteSize, alignment = 4) {
    this.heapOffset = this.align(this.heapOffset, alignment);
    const address = this.heapBase + this.heapOffset;
    this.heapOffset += byteSize;
    return this.format(address);
  }

  contiguousAddresses(baseAddress, count, type) {
    const start = Number.parseInt(baseAddress.replace('0x', ''), 16);
    const size = this.getTypeSize(type);
    return Array.from({ length: count }, (_, index) => this.format(start + index * size));
  }
}

function translateExplanation(text) {
  return text
    .replace('Enter the main function', 'Entrar na funcao principal')
    .replace(/Create integer "(.+)"/, 'Criar o inteiro "$1"')
    .replace(/Point "(.+)" to "(.+)"/, 'Apontar "$1" para "$2"')
    .replace(/Allocate memory for "(.+)"/, 'Alocar memoria para "$1"')
    .replace(/Write (.+) to (.+)/, 'Escrever $1 em $2')
    .replace(/Create a new (.+) object/, 'Criar um novo objeto $1')
    .replace(/Update (.+)/, 'Atualizar $1')
    .replace(/Alias "(.+)" to the same object/, 'Fazer "$1" referenciar o mesmo objeto')
    .replace('Write a value to standard output', 'Escrever um valor na saida padrao')
    .replace(/Release memory owned by "(.+)"/, 'Liberar a memoria de "$1"')
    .replace('Return from the main function', 'Retornar da funcao principal')
    .replace('Execute the first statement', 'Executar a primeira instrucao');
}

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
    return String(heap[0]?.fields?.name ?? 'Ada');
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

function addResponseTranslations() {
  app.use((req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      if (body?.steps) {
        body.steps = body.steps.map((step) => ({
          ...step,
          event: eventLabels[step.event] || step.event,
          explanation: translateExplanation(step.explanation),
        }));
      }

      if (body?.error) {
        body.error = body.error
          .replace('Code may not exceed 500 lines.', 'O codigo nao pode ultrapassar 500 linhas.')
          .replace('Unsupported language. Choose C, C++, or Java.', 'Linguagem nao suportada. Escolha C, C++ ou Java.')
          .replace('The editor is empty. Add a program before running it.', 'O editor esta vazio. Adicione um programa antes de executar.')
          .replace('Error: Time limit exceeded. Check for infinite loops.', 'Erro: limite de tempo excedido. Verifique se ha loops infinitos.')
          .replace('Compilation error:', 'Erro de compilacao:')
          .replace("undefined reference to 'main'", "referencia indefinida para 'main'")
          .replace('class declaration expected', 'era esperada uma declaracao de classe')
          .replace('Trace not found', 'Rastreamento nao encontrado');
      }

      return originalJson(body);
    };

    next();
  });
}

addResponseTranslations();

function trace(language, code) {
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

    match = statement.match(/^(\w+)\s*=\s*new\s+(\w+)\s*;/);
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

    match = statement.match(/^(\w+)\.(\w+)\s*=\s*(?:"([^"]*)"|(-?\d+))\s*;/);
    if (match) {
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

app.post('/api/run', (req, res) => {
  try {
    const hash = crypto.createHash('md5').update(JSON.stringify(req.body)).digest('hex');

    if (cache.has(hash)) {
      return res.json({ ...cache.get(hash), cached: true });
    }

    const result = trace(req.body.language, req.body.code);
    cache.set(hash, result);
    setTimeout(() => cache.delete(hash), 600000);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.get('/api/cached/:hash', (req, res) => {
  if (cache.has(req.params.hash)) {
    return res.json(cache.get(req.params.hash));
  }

  return res.status(404).json({ error: 'Trace not found' });
});

app.get('/api/languages', (_, res) => res.json([{ id: 'c', label: 'C' }, { id: 'cpp', label: 'C++' }, { id: 'java', label: 'Java' }]));
app.get('/api/health', (_, res) => res.json({ status: 'ok', sandbox: 'simulated', cache: 'memory' }));

app.use(express.static('dist'));
app.use((req, res) => res.sendFile('index.html', { root: 'dist' }));

app.listen(3001, () => {
  console.log('CodeVisualizer API running at http://localhost:3001');
});
