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

function translateErrorMessage(errorMessage) {
  return errorMessage
    .replace('Code may not exceed 500 lines.', 'O codigo nao pode ultrapassar 500 linhas.')
    .replace('Unsupported language. Choose C, C++, or Java.', 'Linguagem nao suportada. Escolha C, C++ ou Java.')
    .replace('The editor is empty. Add a program before running it.', 'O editor esta vazio. Adicione um programa antes de executar.')
    .replace('Error: Time limit exceeded. Check for infinite loops.', 'Erro: limite de tempo excedido. Verifique se ha loops infinitos.')
    .replace('Compilation error:', 'Erro de compilacao:')
    .replace("undefined reference to 'main'", "referencia indefinida para 'main'")
    .replace('class declaration expected', 'era esperada uma declaracao de classe')
    .replace('Trace not found', 'Rastreamento nao encontrado');
}

export function translateResponseMiddleware(req, res, next) {
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
      body.error = translateErrorMessage(body.error);
    }

    return originalJson(body);
  };

  next();
}
