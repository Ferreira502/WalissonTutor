# CodeVisualizer — Debugger Visual para Ensino de Programação

Ferramenta web que executa código passo a passo e visualiza em tempo real variáveis, objetos, ponteiros, estruturas de dados e a pilha de execução. Voltada para alunos, professores e programadores que precisam entender o comportamento interno de um programa.

> **Escopo atual:** sem autenticação ou gestão de usuários. O sistema funciona como um transformador direto de código em visualização, com suporte a C, C++ e Java.

---

## Stack Tecnológica

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Frontend | React + TypeScript | Tipagem estática para gerenciar estados complexos (histórico de memória) |
| Editor de Código | Monaco Editor | Motor do VS Code — autocompletar e detecção de sintaxe nativos |
| Visualização | D3.js / React Flow | Renderização de grafos, setas de ponteiros e estruturas dinâmicas |
| Backend | Python (FastAPI) | Coordena os workers e roteamento por linguagem |
| Cache | Redis | Fila assíncrona e cache de execuções por hash MD5 |
| Motor C/C++ | GDB (GNU Debugger) | Extrai endereços de memória e valores após compilação com `gcc -g` |
| Motor Java | JDI (Java Debug Interface) | Inspeciona Stack e Heap da JVM com flags de depuração ativadas |
| Sandbox | Docker + gVisor | Isolamento com limites rígidos de CPU e RAM |

---

## Arquitetura de Execução

O sistema é um pipeline linear: recebe código, compila, executa com tracer e devolve um JSON padronizado ao frontend.

```
[Navegador]
    │  POST /api/run  { language, code }
    ▼
[API Principal]
    │  Rate Limiting + Validação de Payload
    │  Verifica cache Redis (hash MD5 do código)
    ▼
[Message Broker (Redis)]
    │  Fila assíncrona
    ▼
[Worker Node]
    │  1. Compila o código (gcc -g / javac)
    │     → erro de compilação? devolve mensagem ao aluno e para aqui
    │  2. Inicia container efêmero (timeout: 3–5s)
    ▼
┌─────────────────────────────────────────────────┐
│  SANDBOX (Docker + gVisor)                      │
│                                                 │
│  C/C++  → GDB rastreia variáveis e endereços   │
│  Java   → JDI inspeciona JVM (Stack + Heap)    │
│                                                 │
│  🚫 --network none                              │
│  💾 --read-only                                 │
│  ⚖️  128MB RAM · 0.5 CPU · max 50 processos     │
└─────────────────────────────────────────────────┘
    │  JSON de rastreamento (steps[])
    ▼
[Worker] → [Redis cache] → [API] → [Navegador]
```

---

## Suporte Multilinguagem

Cada linguagem exige um runtime diferente dentro da mesma Sandbox:

### C / C++
1. Backend salva o código em um arquivo `.c` / `.cpp`
2. Compila com `gcc -g` ou `g++ -g` (flag `-g` preserva símbolos de depuração)
3. GDB executa o binário e extrai endereços hexadecimais e valores de variáveis a cada linha

### Java
1. Código compilado para `.class` com `javac`
2. JVM iniciada com flags de depuração (`-agentlib:jdwp`)
3. JDI conecta ao processo e inspeciona Stack frames e objetos no Heap

> **Erro de compilação como feedback pedagógico:** se a compilação falhar, o Worker interrompe o pipeline e devolve a mensagem do compilador diretamente ao aluno — parte essencial do aprendizado.

---

## Contrato de Dados — JSON de Rastreamento

O backend devolve sempre o mesmo formato, independente da linguagem. O frontend não precisa saber qual linguagem foi executada.

```json
{
  "steps": [
    {
      "line": 5,
      "event": "step_line",
      "stack": [
        {
          "name": "main",
          "variables": {
            "x": 10,
            "ptr": "0x7ffe"
          }
        }
      ],
      "heap": {
        "0x7ffe": {
          "type": "int_array",
          "values": [1, 2, 3],
          "size": 3
        }
      },
      "stdout": "Valor de x: 10\n"
    }
  ]
}
```

---

## Cache por Hash (Otimização de CPU)

Sem autenticação, o sistema é público — muitos usuários tendem a executar os mesmos exemplos clássicos (Bubble Sort, Fibonacci, Linked List).

Fluxo com cache:

```
código recebido
    │
    ├─ hash MD5 já existe no Redis? ──→ devolve JSON em cache (0 compilação)
    │
    └─ não existe ──→ compila + executa + salva no Redis (TTL: 10 min)
```

---

## Visualização por Linguagem

### C / C++ — Ponteiros com Endereços Reais
- Exibe o endereço hexadecimal ao lado de cada variável
- Se `int *p = &x`, o frontend desenha uma **seta** saindo da caixa de `p` apontando para o endereço de `x`
- Visualização de `malloc` / `free` e explicação de **Segmentation Fault** (ponteiro acessando área não alocada)

### Java — Referências e Aliasing
- Foco na referência de objeto, não no endereço físico
- Mostra que múltiplas variáveis podem apontar para a **mesma instância no Heap** (conceito de Aliasing)
- Diferencia Stack (variáveis locais e primitivos) do Heap (objetos e arrays)

---

## Camadas de Segurança

**Camada 1 — API**
- Rate limiting: máx. 1 requisição/segundo por IP
- Payload limitado a ~500 linhas de código
- Fila Redis para processamento controlado (máx. 5 jobs simultâneos)

**Camada 2 — Container Docker**
- `--network none` — sem acesso à internet ou rede interna
- `--memory="128m" --cpus="0.5"` — impede memory leak e CPU bombing
- `--read-only` — sistema de arquivos imutável dentro do container
- Execução sob usuário sem privilégios (nunca `root`)

**Camada 3 — gVisor**
- Kernel virtual em user-space (projeto Google)
- Ataques a syscalls atingem o gVisor descartável, não o host

**Camada 4 — Timeout (Ceifador)**
- Container encerrado com `SIGKILL` após 3–5 segundos
- Resposta ao frontend: `"Erro: Tempo limite excedido. Verifique loops infinitos."`

---

## Ciclo de Vida de um Container

1. **Nasce** — Worker recebe o job, compila o código e inicia o container Docker + gVisor
2. **Executa** — GDB ou JDI captura o estado da memória a cada linha
3. **Morre** — JSON gerado no `stdout`, container destruído com `docker rm -f`

Nenhum rastro do código permanece no servidor após a execução.

---

## Roadmap de Implementação

### Fase 1 — Infraestrutura Base e C
- Pipeline Worker: receber código → compilar com `gcc -g` → executar com GDB → emitir JSON
- Visualização de Stack com variáveis e endereços hexadecimais
- Interface: editor Monaco + botão Play + slider de linha do tempo
- Sandbox Docker com todas as flags de segurança

### Fase 2 — Suporte a C++ e Ponteiros
- Extensão do Worker para `g++`
- Renderização de setas (SVG/D3) conectando ponteiros aos seus alvos no Heap
- Visualização de `malloc` / `free` e Segmentation Fault

### Fase 3 — Suporte a Java via JDI
- Worker Java: `javac` + JVM com `-agentlib:jdwp` + cliente JDI
- Visualização de referências de objeto e Aliasing no Heap
- Diferenciação visual entre primitivos (Stack) e objetos (Heap)

### Fase 4 — Performance e Experiência
- Cache Redis por hash MD5 (TTL de 10 minutos)
- Feedback de erros de compilação formatado por linguagem
- Suporte a estruturas complexas: Listas Encadeadas, Árvores Binárias, Grafos

---

## Estrutura de Diretórios (Sugerida)

```
codevisualizer/
├── frontend/          # React + TypeScript + Monaco + D3
├── api/               # FastAPI — roteamento e rate limiting
├── worker/
│   ├── gdb_tracer/    # Worker para C e C++
│   └── jdi_tracer/    # Worker para Java
├── sandbox/           # Dockerfiles e configuração gVisor
└── infra/             # Redis (fila + cache)
```
