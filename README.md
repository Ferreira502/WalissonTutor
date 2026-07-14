# WalissonTutor

Visualizador interativo de execução de código com foco em memória, ponteiros, stack e heap.

O projeto foi organizado em `frontend` e `backend` para deixar a estrutura mais clara e facilitar manutenção, evolução e deploy. A interface permite acompanhar a execução passo a passo, destacando linha atual, variáveis criadas, referências, alocações na heap e saída padrão.

## Objetivo

O objetivo deste projeto é ajudar no ensino e na compreensão de conceitos de programação, especialmente:

- execução passo a passo de código
- variáveis locais na stack
- alocação dinâmica na heap
- ponteiros e referências
- saída do programa em tempo real
- visualização didática da memória

Hoje o projeto é especialmente voltado para exemplos em `C`, `C++` e `Java`, com visualização animada no frontend e um backend que gera o rastreamento de execução usado pela interface.

## Tecnologias Utilizadas

### Frontend

- `React`
- `TypeScript`
- `Vite`
- `React Flow`
- `React Spring`
- `Monaco Editor`
- `Lucide React`
- `CSS`

### Backend

- `Node.js`
- `Express`
- `CORS`
- `express-rate-limit`

## Estrutura do Projeto

```text
WalissonTutor/
├── backend/
│   └── index.js
├── frontend/
│   ├── assets/
│   ├── dist/
│   ├── src/
│   │   ├── hooks/
│   │   ├── main.tsx
│   │   ├── plugins.ts
│   │   ├── samples.ts
│   │   ├── styles.css
│   │   ├── types.ts
│   │   └── visualization.ts
│   ├── index.html
│   ├── tsconfig.json
│   └── vite.config.ts
├── package.json
└── package-lock.json
```

## Como Funciona

O fluxo principal do sistema é este:

1. O usuário escreve ou seleciona um código de exemplo no editor.
2. O frontend envia o código para o backend.
3. O backend interpreta esse código e gera uma sequência de passos de execução.
4. O frontend transforma esses passos em uma timeline visual.
5. O React Flow desenha os blocos de memória e as conexões.
6. O React Spring anima mudanças entre um passo e outro.

## Recursos Atuais

- editor de código com `Monaco Editor`
- execução passo a passo
- timeline com navegação manual
- play, pause, próximo passo e passo anterior
- controle de velocidade
- zoom automático na área mais relevante da memória
- destaque visual da linha em execução
- mapa de memória com `stack` e `heap`
- animação de criação e alteração de variáveis
- animação de referências e ponteiros
- saída padrão animada

## Como Rodar o Projeto

### Pré-requisitos

- `Node.js` 18+ recomendado
- `npm`

### Instalação

Na raiz do projeto, execute:

```bash
npm install
```

### Ambiente de desenvolvimento

Para subir frontend e backend ao mesmo tempo:

```bash
npm run dev
```

Isso inicia:

- frontend Vite
- backend Express com `--watch`

### Rodar apenas o frontend

```bash
npm run dev:frontend
```

### Rodar apenas o backend

```bash
npm run dev:backend
```

## Build de Produção

Para gerar o build do frontend:

```bash
npm run build
```

O build final é salvo em:

```text
frontend/dist
```

## Executar em modo produção

Depois do build:

```bash
npm run start
```

O backend servirá os arquivos do frontend já compilados.

## Scripts Disponíveis

```bash
npm run dev
npm run dev:frontend
npm run dev:backend
npm run build
npm run build:frontend
npm run start
```

## Observações Técnicas

- O backend atual gera um rastreamento de execução didático, baseado em heurísticas.
- Ele já cobre casos comuns de variáveis, ponteiros, `malloc`, `free`, vetores simples e alguns cenários em Java.
- A visualização foi desenhada para ser educativa e visualmente clara, não para substituir um compilador ou depurador real.

## Possíveis Evoluções

- suporte mais completo a estruturas e funções
- rastreamento mais fiel para C++ real
- visualização de structs e classes
- histórico detalhado de valores por variável
- exportação de cenários de execução
- suporte a novos tipos e containers

## Autor / Contexto

Este projeto faz parte do ambiente `WalissonTutor` e foi estruturado para fins de visualização, ensino e experimentação com execução de código e memória.
