import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor as EditorMonaco, Range } from 'monaco-editor';
import {
  AlertCircle,
  Box,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Layers3,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Sun,
  Terminal,
  WandSparkles,
} from 'lucide-react';
import { animated, useSpring, useSprings, useTransition } from '@react-spring/web';
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useLinhaDoTempoExecucao } from './hooks/useExecutionTimeline';
import { exemplos } from './samples';
import type { DiferencaPasso, ItemHeap, Linguagem, Passo, QuadroPilha, Rastreamento, Variavel, VelocidadeReproducao } from './types';
import { construirDiferencaPasso, construirGrafoMemoria } from './visualization';
import './styles.css';

const rotulosLinguagem: Record<Linguagem, string> = {
  c: 'C',
  cpp: 'C++',
  java: 'Java',
};

const rotulosStatus = {
  idle: 'Nao iniciado',
  running: 'Executando',
  done: 'Concluido',
  error: 'Erro',
} as const;

type AnalisePasso = ReturnType<typeof construirDiferencaPasso>;

type DadosNoQuadroPilha = {
  quadro: QuadroPilha;
  indice: number;
  diferenca: AnalisePasso;
  quadroAnterior: QuadroPilha | null;
  chaveAnimacao: number;
};

type DadosNoBlocoHeap = {
  item: ItemHeap;
  linguagem: Linguagem;
  diferenca: AnalisePasso;
  itemAnterior: ItemHeap | null;
  chaveAnimacao: number;
};

function AplicacaoVisualizadorCodigo() {
  const [linguagemSelecionada, definirLinguagemSelecionada] = useState<Linguagem>('cpp');
  const [codigoFonte, definirCodigoFonte] = useState(exemplos.cpp);
  const [rastreamento, definirRastreamento] = useState<Rastreamento | null>(null);
  const [statusExecucao, definirStatusExecucao] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [erroExecucao, definirErroExecucao] = useState('');
  const [tooltipLinhaVisivel, definirTooltipLinhaVisivel] = useState(false);
  const [modoClaroAtivo, definirModoClaroAtivo] = useState(false);

  const editorRef = useRef<EditorMonaco.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<{ Range: typeof Range } | null>(null);
  const idsDecoracaoLinhaRef = useRef<string[]>([]);
  const temporizadorTooltipRef = useRef<number | null>(null);

  const linhaDoTempo = useLinhaDoTempoExecucao(rastreamento);
  const passoAtual = rastreamento?.steps[linhaDoTempo.indicePasso] ?? null;
  const passoAnterior = rastreamento?.steps[linhaDoTempo.indicePasso - 1] ?? null;

  const diferencaAtual = useMemo(() => {
    if (!passoAtual) {
      return null;
    }

    return construirDiferencaPasso(passoAnterior, passoAtual);
  }, [passoAnterior, passoAtual]);

  useEffect(() => {
    if (!passoAtual || !editorRef.current || !monacoRef.current) {
      return;
    }

    const faixaLinha = new monacoRef.current.Range(passoAtual.line, 1, passoAtual.line, 1);

    idsDecoracaoLinhaRef.current = editorRef.current.deltaDecorations(idsDecoracaoLinhaRef.current, [
      {
        range: faixaLinha,
        options: {
          isWholeLine: true,
          className: 'executingLine',
          linesDecorationsClassName: 'executingGlyph',
        },
      },
    ]);

    editorRef.current.revealLineInCenter(passoAtual.line);
    definirTooltipLinhaVisivel(true);

    if (temporizadorTooltipRef.current) {
      window.clearTimeout(temporizadorTooltipRef.current);
    }

    temporizadorTooltipRef.current = window.setTimeout(() => {
      definirTooltipLinhaVisivel(false);
    }, 1000 / linhaDoTempo.velocidade);
  }, [linhaDoTempo.velocidade, passoAtual]);

  const aoMontarEditor: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = { Range: monaco.Range };
  };

  async function executarRastreamento() {
    definirStatusExecucao('running');
    definirErroExecucao('');
    linhaDoTempo.definirReproduzindo(false);

    try {
      const resposta = await fetch('/api/run', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          language: linguagemSelecionada,
          code: codigoFonte,
        }),
      });

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(resultado.error);
      }

      definirRastreamento(resultado);
      linhaDoTempo.definirIndicePasso(0);
      definirStatusExecucao('done');
    } catch (erro) {
      definirStatusExecucao('error');
      definirErroExecucao(erro instanceof Error ? erro.message : 'Falha na execucao');
    }
  }

  function alterarLinguagem(linguagem: Linguagem) {
    definirLinguagemSelecionada(linguagem);
    definirCodigoFonte(exemplos[linguagem]);
    definirRastreamento(null);
    linhaDoTempo.reiniciar();
    definirStatusExecucao('idle');
    definirErroExecucao('');
  }

  const velocidadesDisponiveis: VelocidadeReproducao[] = [0.5, 1, 2, 4];
  const nomeArquivoAtual =
    linguagemSelecionada === 'java' ? 'Main.java' : linguagemSelecionada === 'cpp' ? 'main.cpp' : 'main.c';
  const rotuloLinhaAtual = diferencaAtual ? diferencaAtual.currentLineLabel : 'Aguardando execucao';

  return (
    <div className={`app ${modoClaroAtivo ? 'lightTheme' : ''}`}>
      <header className="topbar">
        <div className="brandBlock">
          <div className="brand brandMinimal">
            <b>WalissonTutor</b>
          </div>
          <small>Editor lateral com visualizacao em tempo real.</small>
        </div>

        <nav className="topnav" aria-label="Navegacao principal">
          <a href="#editor" className="active">
            Codigo
          </a>
          <a href="#memoria">Visualizacao</a>
          <a href="#controle">Passos</a>
        </nav>

        <button
          type="button"
          className="themeToggle"
          aria-label={modoClaroAtivo ? 'Ativar modo escuro' : 'Ativar modo claro'}
          title={modoClaroAtivo ? 'Modo escuro' : 'Modo claro'}
          onClick={() => definirModoClaroAtivo((valorAtual) => !valorAtual)}
        >
          {modoClaroAtivo ? <Sun /> : <Moon />}
        </button>
      </header>

      <main className="dashboard">
        <section className="panel source" id="editor">
          <div className="sourceFrame">
            <aside className="sourceMenu">
              <span className="sourceMenuLabel">Home</span>

              <div className="sourceStatusList">
                <div className="sourceStatusCard">
                  <span>Linguagem</span>
                  <strong>{rotulosLinguagem[linguagemSelecionada]}</strong>
                </div>

                <div className="sourceStatusCard">
                  <span>Status</span>
                  <strong>{rotulosStatus[statusExecucao]}</strong>
                </div>

                <div className="sourceStatusCard">
                  <span>Passos</span>
                  <strong>{rastreamento ? `${linhaDoTempo.indicePasso + 1}/${rastreamento.steps.length}` : '0/0'}</strong>
                </div>
              </div>
            </aside>

            <div className="sourceContent">
              <div className="toolbar">
                <nav aria-label="Escolha de linguagem">
                  {(['c', 'cpp', 'java'] as Linguagem[]).map((linguagem) => (
                    <button
                      key={linguagem}
                      type="button"
                      className={linguagem === linguagemSelecionada ? 'active' : ''}
                      aria-pressed={linguagem === linguagemSelecionada}
                      onClick={() => alterarLinguagem(linguagem)}
                    >
                      {rotulosLinguagem[linguagem]}
                    </button>
                  ))}
                </nav>

                <code>{nomeArquivoAtual}</code>

                <button className="restore" type="button" onClick={() => definirCodigoFonte(exemplos[linguagemSelecionada])}>
                  <RotateCcw />
                  Restaurar exemplo
                </button>
              </div>

              <div className="editorWrap">
                <div className={`lineTooltip ${tooltipLinhaVisivel ? 'visible' : ''}`}>
                  {passoAtual ? `Executando: ${diferencaAtual?.currentLineLabel}` : 'Pronto para executar'}
                </div>

                <div className="editor">
                  <Editor
                    language={linguagemSelecionada === 'cpp' ? 'cpp' : linguagemSelecionada}
                    value={codigoFonte}
                    onMount={aoMontarEditor}
                    onChange={(valor) => definirCodigoFonte(valor ?? '')}
                    theme={modoClaroAtivo ? 'vs' : 'vs-dark'}
                    options={{
                      fontSize: 14,
                      fontFamily: 'JetBrains Mono',
                      minimap: { enabled: false },
                      padding: { top: 18 },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      lineNumbersMinChars: 3,
                      glyphMargin: true,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="panel visual" id="memoria">
          <div className="visualHead">
            <div>
              <small>EXECUCAO</small>
              <h2>{passoAtual ? passoAtual.explanation : 'Pronto para rastrear'}</h2>
            </div>

            <span className={`badge ${statusExecucao}`}>
              {statusExecucao === 'done' ? <CheckCircle2 /> : statusExecucao === 'error' ? <AlertCircle /> : <i />}
              {rotulosStatus[statusExecucao]}
            </span>
          </div>

          {!passoAtual && !erroExecucao && (
            <div className="empty">
              <span>
                <Play />
              </span>

              <h3>Execucao passo a passo</h3>
              <p>Execute o exemplo para ver a stack, a heap e as referencias mudando ao longo da execucao.</p>
            </div>
          )}

          {erroExecucao && (
            <div className="error">
              <AlertCircle />

              <div>
                <b>Execucao interrompida</b>
                <pre>{erroExecucao}</pre>
              </div>
            </div>
          )}

          {passoAtual && diferencaAtual && (
            <DiagramaMemoria
              passo={passoAtual}
              passoAnterior={passoAnterior}
              linguagem={linguagemSelecionada}
              diferenca={diferencaAtual}
              chaveAnimacao={linhaDoTempo.chaveAnimacao}
              emTransicao={linhaDoTempo.emTransicao}
              velocidade={linhaDoTempo.velocidade}
            />
          )}
        </section>
      </main>

      <footer id="controle">
        <div className="controls">
          <span className={`footerStatus ${statusExecucao}`}>{rotulosStatus[statusExecucao]}</span>

          <button type="button" onClick={executarRastreamento} disabled={statusExecucao === 'running'} className="runAction">
            {statusExecucao === 'running' ? <i className="spinner" /> : <Play />}
          </button>

          <button
            type="button"
            title="Reiniciar"
            aria-label="Reiniciar animacao"
            onClick={linhaDoTempo.reiniciar}
            disabled={!rastreamento || linhaDoTempo.indicePasso === 0}
          >
            <RotateCcw />
          </button>

          <button
            type="button"
            title="Passo anterior"
            aria-label="Passo anterior"
            onClick={linhaDoTempo.voltar}
            disabled={!rastreamento || linhaDoTempo.indicePasso === 0}
          >
            <ChevronLeft />
          </button>

          <button
            type="button"
            title={linhaDoTempo.reproduzindo ? 'Pausar' : 'Reproduzir'}
            aria-label={linhaDoTempo.reproduzindo ? 'Pausar animacao' : 'Reproduzir animacao'}
            className="play"
            onClick={() => linhaDoTempo.definirReproduzindo((valorAtual) => !valorAtual)}
            disabled={!rastreamento}
          >
            {linhaDoTempo.reproduzindo ? <Pause /> : <Play />}
          </button>

          <button
            type="button"
            title="Proximo passo"
            aria-label="Proximo passo"
            onClick={linhaDoTempo.avancar}
            disabled={!rastreamento || linhaDoTempo.indicePasso === linhaDoTempo.indiceMaximo}
          >
            <ChevronRight />
          </button>
        </div>

        <div className="timeline">
          <div>
            <b>{rastreamento ? `Passo ${linhaDoTempo.indicePasso + 1} de ${rastreamento.steps.length}` : 'Nenhum rastreamento carregado'}</b>
            <span>{rotuloLinhaAtual}</span>
          </div>

          <input
            type="range"
            min="0"
            max={linhaDoTempo.indiceMaximo}
            value={linhaDoTempo.indicePasso}
            aria-label="Linha do tempo da execucao"
            disabled={!rastreamento}
            onChange={(evento) => linhaDoTempo.definirIndicePasso(Number(evento.target.value))}
            style={{ '--p': `${linhaDoTempo.progressoLinhaDoTempo * 100}%` } as React.CSSProperties}
          />
        </div>

        <label className="speedGroup">
          <span>{nomeArquivoAtual}</span>

          <div className="speedButtons" role="radiogroup" aria-label="Velocidade da animacao">
            {velocidadesDisponiveis.map((velocidade) => (
              <button
                key={velocidade}
                type="button"
                className={linhaDoTempo.velocidade === velocidade ? 'active' : ''}
                aria-pressed={linhaDoTempo.velocidade === velocidade}
                onClick={() => linhaDoTempo.definirVelocidade(velocidade)}
              >
                {velocidade}x
              </button>
            ))}
          </div>
        </label>
      </footer>
    </div>
  );
}

function DiagramaMemoria({
  passo,
  passoAnterior,
  linguagem,
  diferenca,
  chaveAnimacao,
  emTransicao,
  velocidade,
}: {
  passo: Passo;
  passoAnterior: Passo | null;
  linguagem: Linguagem;
  diferenca: AnalisePasso;
  chaveAnimacao: number;
  emTransicao: boolean;
  velocidade: VelocidadeReproducao;
}) {
  const [instanciaFluxo, definirInstanciaFluxo] = useState<ReactFlowInstance | null>(null);

  const tiposNos = useMemo(
    () => ({
      stackFrame: NoQuadroPilha,
      heapBlock: NoBlocoHeap,
    }),
    [],
  );

  const grafoMemoria = useMemo(
    () =>
      construirGrafoMemoria({
        passo,
        passoAnterior,
        linguagem,
        diferenca,
        chaveAnimacao,
      }),
    [chaveAnimacao, diferenca, linguagem, passo, passoAnterior],
  );

  useEffect(() => {
    if (!instanciaFluxo) {
      return;
    }

    const nosEmFoco = grafoMemoria.nodes.filter((no) => diferenca.focusNodeIds.includes(no.id));

    if (nosEmFoco.length > 0) {
      instanciaFluxo.fitView({
        nodes: nosEmFoco,
        duration: Math.max(280, 700 / velocidade),
        padding: 0.35,
      });
      return;
    }

    instanciaFluxo.fitView({
      duration: Math.max(280, 700 / velocidade),
      padding: 0.2,
    });
  }, [diferenca.focusNodeIds, grafoMemoria.nodes, instanciaFluxo, velocidade]);

  const animacaoBanner = useSpring({
    from: { opacity: 0, y: 10 },
    to: { opacity: 1, y: 0 },
    reset: true,
    delay: 40,
    config: { tension: 220, friction: 24 },
  });

  return (
    <div className="memoryView">
      <animated.div className="focusBanner" style={animacaoBanner}>
        <div className="focusBannerLine">
          <WandSparkles />
          <b>{diferenca.currentLineLabel}</b>
          <span>{emTransicao ? 'Atualizando' : 'Estavel'}</span>
        </div>

        <div className="focusBannerTargets">
          {diferenca.narrative.slice(0, 2).map((mensagem) => (
            <span key={mensagem}>{mensagem}</span>
          ))}
        </div>
      </animated.div>

      <div className="memorySummary">
        <div className="memorySummaryMain">
          <TituloSecao icon={<Layers3 />} title="Mapa de memoria" sub="Leitura simples da stack, heap e referencias" />

          <div className="memoryInsight">
            <b>{passo.explanation}</b>
            <span>{diferenca.narrative[0]}</span>
          </div>
        </div>

        <div className="memorySummaryStats">
          <span>{passo.stack.length} frame(s)</span>
          <span>{passo.heap.length} bloco(s) na heap</span>
          <span>{diferenca.referenceEdges.length} seta(s)</span>
          <span>{diferenca.stdoutDelta ? 'stdout ativo' : 'stdout ocioso'}</span>
        </div>
      </div>

      <div className="memoryCanvas" aria-label="Diagrama interativo da memoria">
        <ReactFlowProvider>
          <ReactFlow
            nodes={grafoMemoria.nodes}
            edges={grafoMemoria.edges}
            nodeTypes={tiposNos}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.55}
            maxZoom={1.6}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            panOnDrag
            zoomOnDoubleClick={false}
            onInit={definirInstanciaFluxo}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={22} size={1} color="#1b2432" />
          </ReactFlow>
        </ReactFlowProvider>
      </div>

      <div className="memoryMetaGrid">
        <section className="metaCard">
          <TituloSecao icon={<Box />} title="Mudancas do passo" sub="Antes e depois do estado atual" />

          <div className="metaList">
            {diferenca.narrative.concat(grafoMemoria.pluginMessages).slice(0, 5).map((mensagem) => (
              <div className="timelineMetaRow" key={mensagem}>
                <span />
                <p>{mensagem}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="metaCard">
          <TituloSecao icon={<Terminal />} title="Saida padrao" sub="Texto gerado na execucao" />
          <SaidaPadraoAnimada value={passo.stdout} delta={diferenca.stdoutDelta} chaveAnimacao={chaveAnimacao} />
        </section>
      </div>
    </div>
  );
}

function NoQuadroPilha({ data }: NodeProps<Node<DadosNoQuadroPilha>>) {
  const animacaoQuadro = useSpring({
    from: { opacity: 0.72, scale: 0.98 },
    to: { opacity: 1, scale: 1 },
    reset: true,
    config: { tension: 230, friction: 20 },
  });

  const transicoesVariaveis = useTransition(data.quadro.variables, {
    keys: (variavel) => `${data.quadro.name}:${variavel.name}:${variavel.address ?? 'na'}`,
    from: { opacity: 0, y: 18, scale: 0.95 },
    enter: { opacity: 1, y: 0, scale: 1 },
    leave: { opacity: 0, y: -12, scale: 0.95 },
    update: { opacity: 1, y: 0, scale: 1 },
    trail: 60,
    config: { tension: 240, friction: 22 },
  });

  const mapaVariaveisAnteriores = useMemo(() => {
    const mapa = new Map<string, Variavel>();

    data.quadroAnterior?.variables.forEach((variavel) => {
      mapa.set(`${data.quadro.name}:${variavel.name}:${variavel.address ?? 'na'}`, variavel);
    });

    return mapa;
  }, [data.quadro.name, data.quadroAnterior]);

  return (
    <animated.div className="diagramNode stackNode" style={animacaoQuadro}>
      <div className="diagramNodeHeader">
        <span className="chip">STACK</span>
        <b>{data.quadro.name}()</b>
        <em>#{data.indice + 1}</em>
      </div>

      <div className="diagramNodeBody">
        {transicoesVariaveis((estilo, variavel) => {
          const chave = `${data.quadro.name}:${variavel.name}:${variavel.address ?? 'na'}`;

          return (
            <animated.div style={estilo}>
              <LinhaVariavelPilha
                variavel={variavel}
                variavelAnterior={mapaVariaveisAnteriores.get(chave) ?? null}
                nomeQuadro={data.quadro.name}
                diferenca={data.diferenca}
              />
            </animated.div>
          );
        })}
      </div>
    </animated.div>
  );
}

function LinhaVariavelPilha({
  variavel,
  variavelAnterior,
  nomeQuadro,
  diferenca,
}: {
  variavel: Variavel;
  variavelAnterior: Variavel | null;
  nomeQuadro: string;
  diferenca: AnalisePasso;
}) {
  const chaveVariavelAtual = `${nomeQuadro}:${variavel.name}:${variavel.address ?? 'na'}`;
  const ehVariavelNova = diferenca.addedVariableKeys.includes(chaveVariavelAtual);
  const ehVariavelAlterada = diferenca.changedVariableKeys.includes(chaveVariavelAtual) || variavel.changed;
  const houveMudancaRelevante =
    !variavelAnterior ||
    variavelAnterior.value !== variavel.value ||
    variavelAnterior.reference !== variavel.reference ||
    variavelAnterior.type !== variavel.type;

  const animacaoVariavel = useSpring({
    from: {
      boxShadow: ehVariavelNova ? '0 0 0 rgba(102, 221, 177, 0)' : '0 0 0 rgba(130, 103, 240, 0)',
      scale: ehVariavelNova || ehVariavelAlterada ? 0.96 : 1,
      background: 'rgba(8, 12, 17, 0.42)',
    },
    to: async (proximo) => {
      if (ehVariavelNova || ehVariavelAlterada) {
        await proximo({
          scale: 1.02,
          background: ehVariavelNova ? 'rgba(102, 221, 177, 0.16)' : 'rgba(130, 103, 240, 0.18)',
          boxShadow: ehVariavelNova
            ? '0 0 22px rgba(102, 221, 177, 0.2)'
            : '0 0 22px rgba(130, 103, 240, 0.18)',
        });
      }

      await proximo({
        scale: 1,
        background: 'rgba(8, 12, 17, 0.42)',
        boxShadow: '0 0 0 rgba(0, 0, 0, 0)',
      });
    },
    reset: true,
    config: { tension: 240, friction: 17 },
  });

  return (
    <animated.div className={`stackVarRow ${ehVariavelAlterada ? 'changed' : ''}`} style={animacaoVariavel}>
      {variavel.address && <Handle type="target" id={`stack:${variavel.address}`} position={Position.Left} className="memoryHandle" />}

      {variavel.reference && (
        <Handle
          type="source"
          id={`ref:${variavel.name}:${variavel.reference}`}
          position={Position.Right}
          className="memoryHandle source"
        />
      )}

      <div className="stackVarMeta">
        <span>{variavel.type}</span>
        <b>{variavel.name}</b>

        {!variavelAnterior && <small className="valueDelta">nova variavel na stack</small>}

        {variavelAnterior && houveMudancaRelevante && (
          <small className="valueDelta">
            antes: {String(variavelAnterior.value)} -&gt; agora: {String(variavel.value)}
          </small>
        )}
      </div>

      <div className="stackVarValue">
        <code>{String(variavel.value)}</code>
        {variavel.address && <small>{variavel.address}</small>}
      </div>
    </animated.div>
  );
}

function NoBlocoHeap({ data }: NodeProps<Node<DadosNoBlocoHeap>>) {
  const ehAlocacaoNova = data.diferenca.addedHeapAddresses.includes(data.item.address);
  const ehAlocacaoAlterada = data.diferenca.changedHeapAddresses.includes(data.item.address);
  const ehAlocacaoLiberada = data.diferenca.freedHeapAddresses.includes(data.item.address);

  const indicesAlterados = new Set(
    (data.item.values ?? []).flatMap((valor, indice) => (data.itemAnterior?.values?.[indice] !== valor ? [indice] : [])),
  );

  const animacaoBloco = useSpring({
    from: {
      opacity: ehAlocacaoLiberada ? 1 : 0.75,
      scale: ehAlocacaoNova ? 0.82 : 0.96,
    },
    to: async (proximo) => {
      await proximo({
        opacity: 1,
        scale: ehAlocacaoNova || ehAlocacaoAlterada ? 1.03 : 1,
      });

      await proximo({
        opacity: data.item.freed ? 0.55 : 1,
        scale: 1,
      });
    },
    reset: true,
    config: { tension: 230, friction: 20 },
  });

  const valoresCelulas = data.item.values ?? [];

  const [animacoesCelulas] = useSprings(
    valoresCelulas.length,
    (indice) => ({
      from: { opacity: 0, y: 18, scale: 0.9 },
      to: { opacity: 1, y: 0, scale: 1 },
      delay: 80 + indice * 40,
      reset: true,
      config: { tension: 220, friction: 18 },
    }),
    [valoresCelulas.length, data.chaveAnimacao],
  );

  return (
    <animated.div className={`diagramNode heapNode ${data.item.freed ? 'freed' : ''}`} style={animacaoBloco}>
      <Handle type="target" id={`heap:${data.item.address}`} position={Position.Left} className="memoryHandle" />

      <div className="diagramNodeHeader">
        <span className="chip">{data.linguagem === 'java' ? 'OBJ' : 'HEAP'}</span>
        <b>{data.item.type}</b>
        <code>{data.item.address}</code>
      </div>

      <div className="diagramNodeBody">
        {data.item.values && (
          <div className="heapArray">
            {data.item.values.map((valor, indice) => (
              <animated.div
                key={`${data.item.address}-${indice}`}
                className={`heapArrayCell ${indicesAlterados.has(indice) ? 'flash' : ''}`}
                style={animacoesCelulas[indice]}
              >
                <small>{indice}</small>
                <strong>{String(valor)}</strong>
                {data.item.elementAddresses?.[indice] && <code>{data.item.elementAddresses[indice]}</code>}
              </animated.div>
            ))}
          </div>
        )}

        {data.item.fields && (
          <div className="heapFields">
            {Object.entries(data.item.fields).map(([nomeCampo, valorCampo]) => (
              <div className="heapFieldRow" key={`${data.item.address}-${nomeCampo}`}>
                <span>{nomeCampo}</span>
                <b>{String(valorCampo)}</b>
              </div>
            ))}
          </div>
        )}

        {!data.itemAnterior && <small className="heapDelta">alocacao criada neste passo</small>}

        {data.itemAnterior && (ehAlocacaoAlterada || ehAlocacaoLiberada) && (
          <small className="heapDelta">
            antes: {serializarResumoHeap(data.itemAnterior)} | agora: {serializarResumoHeap(data.item)}
          </small>
        )}

        {data.item.freed && <em>LIBERADA</em>}
      </div>
    </animated.div>
  );
}

function SaidaPadraoAnimada({
  value,
  delta,
  chaveAnimacao,
}: {
  value: string;
  delta: string;
  chaveAnimacao: number;
}) {
  const animacaoSaida = useSpring({
    from: {
      opacity: 0.82,
      boxShadow: '0 0 0 rgba(101, 217, 184, 0)',
    },
    to: async (proximo) => {
      if (delta) {
        await proximo({
          opacity: 1,
          boxShadow: '0 0 26px rgba(101, 217, 184, 0.16)',
        });
      }

      await proximo({
        opacity: 1,
        boxShadow: '0 0 0 rgba(101, 217, 184, 0)',
      });
    },
    reset: true,
    config: { tension: 220, friction: 22 },
  });

  const transicaoDelta = useTransition(delta ? [delta] : [], {
    from: { opacity: 0, y: 12 },
    enter: { opacity: 1, y: 0 },
    leave: { opacity: 0, y: -10 },
    config: { tension: 250, friction: 20 },
  });

  return (
    <animated.div className="stdoutPanel" style={animacaoSaida} key={chaveAnimacao}>
      <pre className="stdoutBox">{value || 'Aguardando saida...'}</pre>

      <div className="stdoutDeltaWrap">
        {transicaoDelta((estilo, item) => (
          <animated.div className="stdoutDelta" style={estilo}>
            novo output: {item.trim()}
          </animated.div>
        ))}
      </div>
    </animated.div>
  );
}

function serializarResumoHeap(itemHeap: ItemHeap) {
  if (itemHeap.values) {
    return `[${itemHeap.values.join(', ')}]`;
  }

  if (itemHeap.fields) {
    return Object.entries(itemHeap.fields)
      .map(([nomeCampo, valorCampo]) => `${nomeCampo}:${String(valorCampo)}`)
      .join(', ');
  }

  return itemHeap.type;
}

function TituloSecao({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <div className="title">
      {icon}

      <div>
        <b>{title}</b>
        <small>{sub}</small>
      </div>
    </div>
  );
}

const containerAplicacao = document.getElementById('app');

if (!containerAplicacao) {
  throw new Error('Elemento de montagem #app nao encontrado.');
}

createRoot(containerAplicacao).render(<AplicacaoVisualizadorCodigo />);
