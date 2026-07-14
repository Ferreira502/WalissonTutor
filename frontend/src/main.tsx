import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditor, Range } from 'monaco-editor';
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
  ZoomIn,
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
import { useExecutionTimeline } from './hooks/useExecutionTimeline';
import { samples } from './samples';
import type { HeapItem, Language, PlaybackSpeed, StackFrame, Step, Variable } from './types';
import { buildMemoryGraph, buildStepDiff } from './visualization';
import './styles.css';

const languageLabels: Record<Language, string> = {
  c: 'C',
  cpp: 'C++',
  java: 'Java',
};

type StepAnalysis = ReturnType<typeof buildStepDiff>;

type StackFrameNodeData = {
  frame: StackFrame;
  index: number;
  diff: StepAnalysis;
  previousFrame: StackFrame | null;
  animationKey: number;
};

type HeapBlockNodeData = {
  item: HeapItem;
  language: Language;
  diff: StepAnalysis;
  previousItem: HeapItem | null;
  animationKey: number;
};

function CodeVisualizerApp() {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('cpp');
  const [sourceCode, setSourceCode] = useState(samples.cpp);
  const [trace, setTrace] = useState<import('./types').Trace | null>(null);
  const [executionStatus, setExecutionStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [executionError, setExecutionError] = useState('');
  const [lineTooltipVisible, setLineTooltipVisible] = useState(false);
  const [lightModeEnabled, setLightModeEnabled] = useState(false);

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<{ Range: typeof Range } | null>(null);
  const lineDecorationIdsRef = useRef<string[]>([]);
  const tooltipTimerRef = useRef<number | null>(null);

  const timeline = useExecutionTimeline(trace);
  const currentStep = trace?.steps[timeline.stepIndex] ?? null;
  const previousStep = trace?.steps[timeline.stepIndex - 1] ?? null;

  const currentDiff = useMemo(() => {
    if (!currentStep) {
      return null;
    }

    return buildStepDiff(previousStep, currentStep);
  }, [currentStep, previousStep]);

  useEffect(() => {
    if (!currentStep || !editorRef.current || !monacoRef.current) {
      return;
    }

    const range = new monacoRef.current.Range(currentStep.line, 1, currentStep.line, 1);

    lineDecorationIdsRef.current = editorRef.current.deltaDecorations(lineDecorationIdsRef.current, [
      {
        range,
        options: {
          isWholeLine: true,
          className: 'executingLine',
          linesDecorationsClassName: 'executingGlyph',
        },
      },
    ]);

    editorRef.current.revealLineInCenter(currentStep.line);
    setLineTooltipVisible(true);

    if (tooltipTimerRef.current) {
      window.clearTimeout(tooltipTimerRef.current);
    }

    tooltipTimerRef.current = window.setTimeout(() => {
      setLineTooltipVisible(false);
    }, 1000 / timeline.speed);
  }, [currentStep, timeline.speed]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = { Range: monaco.Range };
  };

  async function runTrace() {
    setExecutionStatus('running');
    setExecutionError('');
    timeline.setPlaying(false);

    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          language: selectedLanguage,
          code: sourceCode,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error);
      }

      setTrace(result);
      timeline.setStepIndex(0);
      setExecutionStatus('done');
    } catch (error) {
      setExecutionStatus('error');
      setExecutionError(error instanceof Error ? error.message : 'Falha na execução');
    }
  }

  function changeLanguage(language: Language) {
    setSelectedLanguage(language);
    setSourceCode(samples[language]);
    setTrace(null);
    timeline.reset();
    setExecutionStatus('idle');
    setExecutionError('');
  }

  const playbackSpeeds: PlaybackSpeed[] = [0.5, 1, 2, 4];

  return (
    <div className={`app ${lightModeEnabled ? 'lightTheme' : ''}`}>
      <header>
        <div className="brand brandMinimal">
          <b>WALISSONTUTOR</b>
        </div>

        <button
          type="button"
          className="themeToggle"
          aria-label={lightModeEnabled ? 'Ativar modo escuro' : 'Ativar modo claro'}
          title={lightModeEnabled ? 'Modo escuro' : 'Modo claro'}
          onClick={() => setLightModeEnabled((enabled) => !enabled)}
        >
          {lightModeEnabled ? <Sun /> : <Moon />}
        </button>
      </header>

      <main>
        <section className="panel source">
          <div className="toolbar">
            <nav aria-label="Escolha de linguagem">
              {(['c', 'cpp', 'java'] as Language[]).map((language) => (
                <button
                  key={language}
                  type="button"
                  className={language === selectedLanguage ? 'active' : ''}
                  aria-pressed={language === selectedLanguage}
                  onClick={() => changeLanguage(language)}
                >
                  {languageLabels[language]}
                </button>
              ))}
            </nav>

            <code>{selectedLanguage === 'java' ? 'Main.java' : selectedLanguage === 'cpp' ? 'main.cpp' : 'main.c'}</code>

            <button className="restore" type="button" onClick={() => setSourceCode(samples[selectedLanguage])}>
              <RotateCcw />
              Restaurar exemplo
            </button>
          </div>

          <div className="editorWrap">
            <div className={`lineTooltip ${lineTooltipVisible ? 'visible' : ''}`}>
              {currentStep ? `Executando: ${currentDiff?.currentLineLabel}` : 'Pronto para executar'}
            </div>

            <div className="editor">
              <Editor
                language={selectedLanguage === 'cpp' ? 'cpp' : selectedLanguage}
                value={sourceCode}
                onMount={handleEditorMount}
                onChange={(value) => setSourceCode(value ?? '')}
                theme={lightModeEnabled ? 'vs' : 'vs-dark'}
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

          <div className="runbar">
            <span>
              <Gauge />
              128 MB · limite de 5 s · rede desativada
            </span>

            <button type="button" onClick={runTrace} disabled={executionStatus === 'running'}>
              {executionStatus === 'running' ? <i className="spinner" /> : <Play />}
              {executionStatus === 'running' ? 'Rastreando...' : 'Executar visualização'}
              <kbd>Ctrl + Enter</kbd>
            </button>
          </div>
        </section>

        <section className="panel visual">
          <div className="visualHead">
            <div>
              <small>RASTREAMENTO DA EXECUÇÃO</small>
              <h2>{currentStep ? currentStep.explanation : 'Pronto para rastrear'}</h2>
            </div>

            <span className={`badge ${executionStatus}`}>
              {executionStatus === 'done' ? <CheckCircle2 /> : executionStatus === 'error' ? <AlertCircle /> : <i />}
              {executionStatus === 'done'
                ? 'Concluído'
                : executionStatus === 'running'
                  ? 'Executando'
                  : executionStatus === 'error'
                    ? 'Erro'
                    : 'Não iniciado'}
            </span>
          </div>

          {!currentStep && !executionError && (
            <div className="empty">
              <span>
                <Play />
              </span>

              <h3>Animação passo a passo</h3>
              <p>Execute o exemplo para ver a stack nascer, a heap crescer e as referências apontarem para a memória.</p>
            </div>
          )}

          {executionError && (
            <div className="error">
              <AlertCircle />

              <div>
                <b>Execução interrompida</b>
                <pre>{executionError}</pre>
              </div>
            </div>
          )}

          {currentStep && currentDiff && (
            <MemoryDiagram
              step={currentStep}
              previousStep={previousStep}
              language={selectedLanguage}
              diff={currentDiff}
              animationKey={timeline.animationKey}
              isTransitioning={timeline.isTransitioning}
              speed={timeline.speed}
            />
          )}
        </section>
      </main>

      <footer>
        <div className="controls">
          <button
            type="button"
            title="Reiniciar"
            aria-label="Reiniciar animação"
            onClick={timeline.reset}
            disabled={!trace || timeline.stepIndex === 0}
          >
            <RotateCcw />
          </button>

          <button
            type="button"
            title="Passo anterior"
            aria-label="Passo anterior"
            onClick={timeline.previous}
            disabled={!trace || timeline.stepIndex === 0}
          >
            <ChevronLeft />
          </button>

          <button
            type="button"
            title={timeline.playing ? 'Pausar' : 'Reproduzir'}
            aria-label={timeline.playing ? 'Pausar animação' : 'Reproduzir animação'}
            className="play"
            onClick={() => timeline.setPlaying((isPlaying) => !isPlaying)}
            disabled={!trace}
          >
            {timeline.playing ? <Pause /> : <Play />}
          </button>

          <button
            type="button"
            title="Próximo passo"
            aria-label="Próximo passo"
            onClick={timeline.next}
            disabled={!trace || timeline.stepIndex === timeline.maxIndex}
          >
            <ChevronRight />
          </button>
        </div>

        <div className="timeline">
          <div>
            <b>{trace ? `Passo ${timeline.stepIndex + 1} de ${trace.steps.length}` : 'Nenhum rastreamento carregado'}</b>
            <span>{currentDiff ? currentDiff.currentLineLabel : 'Execute o código para começar'}</span>
          </div>

          <input
            type="range"
            min="0"
            max={timeline.maxIndex}
            value={timeline.stepIndex}
            aria-label="Linha do tempo da execução"
            disabled={!trace}
            onChange={(event) => timeline.setStepIndex(Number(event.target.value))}
            style={{ '--p': `${timeline.timelineProgress * 100}%` } as React.CSSProperties}
          />
        </div>

        <label className="speedGroup">
          <span>Velocidade</span>

          <div className="speedButtons" role="radiogroup" aria-label="Velocidade da animação">
            {playbackSpeeds.map((speedOption) => (
              <button
                key={speedOption}
                type="button"
                className={timeline.speed === speedOption ? 'active' : ''}
                aria-pressed={timeline.speed === speedOption}
                onClick={() => timeline.setSpeed(speedOption)}
              >
                {speedOption}x
              </button>
            ))}
          </div>
        </label>
      </footer>
    </div>
  );
}

function MemoryDiagram({
  step,
  previousStep,
  language,
  diff,
  animationKey,
  isTransitioning,
  speed,
}: {
  step: Step;
  previousStep: Step | null;
  language: Language;
  diff: StepAnalysis;
  animationKey: number;
  isTransitioning: boolean;
  speed: PlaybackSpeed;
}) {
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  const nodeTypes = useMemo(
    () => ({
      stackFrame: StackFrameNode,
      heapBlock: HeapBlockNode,
    }),
    [],
  );

  const memoryGraph = useMemo(
    () =>
      buildMemoryGraph({
        step,
        previousStep,
        language,
        diff,
        animationKey,
      }),
    [animationKey, diff, language, previousStep, step],
  );

  useEffect(() => {
    if (!reactFlowInstance) {
      return;
    }

    const focusedNodes = memoryGraph.nodes.filter((node) => diff.focusNodeIds.includes(node.id));

    if (focusedNodes.length > 0) {
      reactFlowInstance.fitView({
        nodes: focusedNodes,
        duration: Math.max(280, 700 / speed),
        padding: 0.35,
      });
      return;
    }

    reactFlowInstance.fitView({
      duration: Math.max(280, 700 / speed),
      padding: 0.2,
    });
  }, [diff.focusNodeIds, memoryGraph.nodes, reactFlowInstance, speed]);

  const bannerAnimation = useSpring({
    from: { opacity: 0, y: 10 },
    to: { opacity: 1, y: 0 },
    reset: true,
    delay: 40,
    config: { tension: 220, friction: 24 },
  });

  const tooltipTransition = useTransition([`${animationKey}-${step.line}`], {
    from: { opacity: 0, transform: 'translateY(8px)' },
    enter: { opacity: 1, transform: 'translateY(0px)' },
    leave: { opacity: 0, transform: 'translateY(-8px)' },
    config: { tension: 250, friction: 22 },
  });

  return (
    <div className="memoryView">
      <animated.div className="focusBanner" style={bannerAnimation}>
        <div className="focusBannerLine">
          <WandSparkles />
          <b>{diff.currentLineLabel}</b>
          <span>{isTransitioning ? 'Animando alterações...' : 'Estado estabilizado'}</span>
        </div>

        <div className="focusBannerTargets">
          {diff.narrative.slice(0, 3).map((message) => (
            <span key={message}>{message}</span>
          ))}
        </div>
      </animated.div>

      <div className="memorySummary">
        <Title icon={<Layers3 />} title="Mapa de memória" sub="Timeline, foco e referências animadas" />

        <div className="memorySummaryStats">
          <span>{step.stack.length} frame(s)</span>
          <span>{step.heap.length} bloco(s) na heap</span>
          <span>{diff.referenceEdges.length} seta(s) destacada(s)</span>
          <span>{diff.stdoutDelta ? 'stdout ativo' : 'stdout ocioso'}</span>
        </div>
      </div>

      <div className="memoryCanvas" aria-label="Diagrama interativo da memória">
        <ReactFlowProvider>
          <ReactFlow
            nodes={memoryGraph.nodes}
            edges={memoryGraph.edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.55}
            maxZoom={1.6}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            panOnDrag
            zoomOnDoubleClick={false}
            onInit={setReactFlowInstance}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={22} size={1} color="#1b2432" />
          </ReactFlow>
        </ReactFlowProvider>

        {tooltipTransition((style) => (
          <animated.div className="memoryTooltip" style={style}>
            <ZoomIn />

            <div>
              <b>{step.explanation}</b>
              <span>{diff.narrative[0]}</span>
            </div>
          </animated.div>
        ))}
      </div>

      <div className="memoryMetaGrid">
        <section className="metaCard">
          <Title icon={<Box />} title="Timeline de mudanças" sub="Antes e depois do passo atual" />

          <div className="metaList">
            {diff.narrative.concat(memoryGraph.pluginMessages).slice(0, 5).map((message) => (
              <div className="timelineMetaRow" key={message}>
                <span />
                <p>{message}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="metaCard">
          <Title icon={<Terminal />} title="Saída padrão" sub="Animada por passo" />
          <AnimatedStdout value={step.stdout} delta={diff.stdoutDelta} animationKey={animationKey} />
        </section>
      </div>
    </div>
  );
}

function StackFrameNode({ data }: NodeProps<Node<StackFrameNodeData>>) {
  const frameAnimation = useSpring({
    from: { opacity: 0.72, scale: 0.98 },
    to: { opacity: 1, scale: 1 },
    reset: true,
    config: { tension: 230, friction: 20 },
  });

  const variableTransitions = useTransition(data.frame.variables, {
    keys: (variable) => `${data.frame.name}:${variable.name}:${variable.address ?? 'na'}`,
    from: { opacity: 0, y: 18, scale: 0.95 },
    enter: { opacity: 1, y: 0, scale: 1 },
    leave: { opacity: 0, y: -12, scale: 0.95 },
    update: { opacity: 1, y: 0, scale: 1 },
    trail: 60,
    config: { tension: 240, friction: 22 },
  });

  const previousVariablesByKey = useMemo(() => {
    const variableMap = new Map<string, Variable>();

    data.previousFrame?.variables.forEach((variable) => {
      variableMap.set(`${data.frame.name}:${variable.name}:${variable.address ?? 'na'}`, variable);
    });

    return variableMap;
  }, [data.frame.name, data.previousFrame]);

  return (
    <animated.div className="diagramNode stackNode" style={frameAnimation}>
      <div className="diagramNodeHeader">
        <span className="chip">STACK</span>
        <b>{data.frame.name}()</b>
        <em>#{data.index + 1}</em>
      </div>

      <div className="diagramNodeBody">
        {variableTransitions((style, variable) => {
          const variableKey = `${data.frame.name}:${variable.name}:${variable.address ?? 'na'}`;

          return (
            <animated.div style={style}>
              <StackVariableRow
                variable={variable}
                previousVariable={previousVariablesByKey.get(variableKey) ?? null}
                frameName={data.frame.name}
                diff={data.diff}
              />
            </animated.div>
          );
        })}
      </div>
    </animated.div>
  );
}

function StackVariableRow({
  variable,
  previousVariable,
  frameName,
  diff,
}: {
  variable: Variable;
  previousVariable: Variable | null;
  frameName: string;
  diff: StepAnalysis;
}) {
  const variableKey = `${frameName}:${variable.name}:${variable.address ?? 'na'}`;
  const isNewVariable = diff.addedVariableKeys.includes(variableKey);
  const isChangedVariable = diff.changedVariableKeys.includes(variableKey) || variable.changed;
  const hasMeaningfulChange =
    !previousVariable ||
    previousVariable.value !== variable.value ||
    previousVariable.reference !== variable.reference ||
    previousVariable.type !== variable.type;

  const variableAnimation = useSpring({
    from: {
      boxShadow: isNewVariable ? '0 0 0 rgba(102, 221, 177, 0)' : '0 0 0 rgba(130, 103, 240, 0)',
      scale: isNewVariable || isChangedVariable ? 0.96 : 1,
      background: 'rgba(8, 12, 17, 0.42)',
    },
    to: async (next) => {
      if (isNewVariable || isChangedVariable) {
        await next({
          scale: 1.02,
          background: isNewVariable ? 'rgba(102, 221, 177, 0.16)' : 'rgba(130, 103, 240, 0.18)',
          boxShadow: isNewVariable
            ? '0 0 22px rgba(102, 221, 177, 0.2)'
            : '0 0 22px rgba(130, 103, 240, 0.18)',
        });
      }

      await next({
        scale: 1,
        background: 'rgba(8, 12, 17, 0.42)',
        boxShadow: '0 0 0 rgba(0, 0, 0, 0)',
      });
    },
    reset: true,
    config: { tension: 240, friction: 17 },
  });

  return (
    <animated.div className={`stackVarRow ${isChangedVariable ? 'changed' : ''}`} style={variableAnimation}>
      {variable.address && (
        <Handle type="target" id={`stack:${variable.address}`} position={Position.Left} className="memoryHandle" />
      )}

      {variable.reference && (
        <Handle type="source" id={`ref:${variable.name}:${variable.reference}`} position={Position.Right} className="memoryHandle source" />
      )}

      <div className="stackVarMeta">
        <span>{variable.type}</span>
        <b>{variable.name}</b>

        {!previousVariable && <small className="valueDelta">nova variável na stack</small>}

        {previousVariable && hasMeaningfulChange && (
          <small className="valueDelta">
            antes: {String(previousVariable.value)} → agora: {String(variable.value)}
          </small>
        )}
      </div>

      <div className="stackVarValue">
        <code>{String(variable.value)}</code>
        {variable.address && <small>{variable.address}</small>}
      </div>
    </animated.div>
  );
}

function HeapBlockNode({ data }: NodeProps<Node<HeapBlockNodeData>>) {
  const isNewAllocation = data.diff.addedHeapAddresses.includes(data.item.address);
  const isChangedAllocation = data.diff.changedHeapAddresses.includes(data.item.address);
  const isFreedAllocation = data.diff.freedHeapAddresses.includes(data.item.address);

  const changedIndexes = new Set(
    (data.item.values ?? []).flatMap((value, index) =>
      data.previousItem?.values?.[index] !== value ? [index] : [],
    ),
  );

  const blockAnimation = useSpring({
    from: {
      opacity: isFreedAllocation ? 1 : 0.75,
      scale: isNewAllocation ? 0.82 : 0.96,
    },
    to: async (next) => {
      await next({
        opacity: 1,
        scale: isNewAllocation || isChangedAllocation ? 1.03 : 1,
      });

      await next({
        opacity: data.item.freed ? 0.55 : 1,
        scale: 1,
      });
    },
    reset: true,
    config: { tension: 230, friction: 20 },
  });

  const cellValues = data.item.values ?? [];

  const [cellAnimations] = useSprings(
    cellValues.length,
    (index) => ({
      from: { opacity: 0, y: 18, scale: 0.9 },
      to: { opacity: 1, y: 0, scale: 1 },
      delay: 80 + index * 40,
      reset: true,
      config: { tension: 220, friction: 18 },
    }),
    [cellValues.length, data.animationKey],
  );

  return (
    <animated.div className={`diagramNode heapNode ${data.item.freed ? 'freed' : ''}`} style={blockAnimation}>
      <Handle type="target" id={`heap:${data.item.address}`} position={Position.Left} className="memoryHandle" />

      <div className="diagramNodeHeader">
        <span className="chip">{data.language === 'java' ? 'OBJ' : 'HEAP'}</span>
        <b>{data.item.type}</b>
        <code>{data.item.address}</code>
      </div>

      <div className="diagramNodeBody">
        {data.item.values && (
          <div className="heapArray">
            {data.item.values.map((value, index) => (
              <animated.div
                key={`${data.item.address}-${index}`}
                className={`heapArrayCell ${changedIndexes.has(index) ? 'flash' : ''}`}
                style={cellAnimations[index]}
              >
                <small>{index}</small>
                <strong>{String(value)}</strong>
                {data.item.elementAddresses?.[index] && <code>{data.item.elementAddresses[index]}</code>}
              </animated.div>
            ))}
          </div>
        )}

        {data.item.fields && (
          <div className="heapFields">
            {Object.entries(data.item.fields).map(([fieldName, fieldValue]) => (
              <div className="heapFieldRow" key={`${data.item.address}-${fieldName}`}>
                <span>{fieldName}</span>
                <b>{String(fieldValue)}</b>
              </div>
            ))}
          </div>
        )}

        {!data.previousItem && <small className="heapDelta">alocação criada neste passo</small>}

        {data.previousItem && (isChangedAllocation || isFreedAllocation) && (
          <small className="heapDelta">
            antes: {serializeHeapPreview(data.previousItem)} · agora: {serializeHeapPreview(data.item)}
          </small>
        )}

        {data.item.freed && <em>LIBERADA</em>}
      </div>
    </animated.div>
  );
}

function AnimatedStdout({
  value,
  delta,
  animationKey,
}: {
  value: string;
  delta: string;
  animationKey: number;
}) {
  const stdoutAnimation = useSpring({
    from: {
      opacity: 0.82,
      boxShadow: '0 0 0 rgba(101, 217, 184, 0)',
    },
    to: async (next) => {
      if (delta) {
        await next({
          opacity: 1,
          boxShadow: '0 0 26px rgba(101, 217, 184, 0.16)',
        });
      }

      await next({
        opacity: 1,
        boxShadow: '0 0 0 rgba(101, 217, 184, 0)',
      });
    },
    reset: true,
    config: { tension: 220, friction: 22 },
  });

  const deltaTransition = useTransition(delta ? [delta] : [], {
    from: { opacity: 0, y: 12 },
    enter: { opacity: 1, y: 0 },
    leave: { opacity: 0, y: -10 },
    config: { tension: 250, friction: 20 },
  });

  return (
    <animated.div className="stdoutPanel" style={stdoutAnimation} key={animationKey}>
      <pre className="stdoutBox">{value || 'Aguardando saída...'}</pre>

      <div className="stdoutDeltaWrap">
        {deltaTransition((style, item) => (
          <animated.div className="stdoutDelta" style={style}>
            novo output: {item.trim()}
          </animated.div>
        ))}
      </div>
    </animated.div>
  );
}

function serializeHeapPreview(heapItem: HeapItem) {
  if (heapItem.values) {
    return `[${heapItem.values.join(', ')}]`;
  }

  if (heapItem.fields) {
    return Object.entries(heapItem.fields)
      .map(([fieldName, fieldValue]) => `${fieldName}:${String(fieldValue)}`)
      .join(', ');
  }

  return heapItem.type;
}

function Title({
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

const appContainer = document.getElementById('app');

if (!appContainer) {
  throw new Error('Elemento de montagem #app não encontrado.');
}

createRoot(appContainer).render(<CodeVisualizerApp />);
