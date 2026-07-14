import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PlaybackSpeed, Trace } from '../types';

const STEP_DURATION_MS = 1500;

function clamp(index: number, max: number) {
  return Math.min(Math.max(index, 0), max);
}

export function useExecutionTimeline(trace: Trace | null) {
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [animationKey, setAnimationKey] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimerRef = useRef<number | null>(null);

  const maxIndex = Math.max(0, (trace?.steps.length ?? 1) - 1);

  useEffect(() => {
    setStepIndex(0);
    setPlaying(false);
    setAnimationKey(0);
    setIsTransitioning(false);
  }, [trace?.id]);

  useEffect(() => {
    if (transitionTimerRef.current) {
      window.clearTimeout(transitionTimerRef.current);
    }

    setAnimationKey((value) => value + 1);
    setIsTransitioning(true);
    transitionTimerRef.current = window.setTimeout(() => {
      setIsTransitioning(false);
    }, STEP_DURATION_MS / speed);

    return () => {
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, [speed, stepIndex]);

  useEffect(() => {
    if (!playing || !trace) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setStepIndex((currentIndex) => {
        if (currentIndex >= maxIndex) {
          setPlaying(false);
          return currentIndex;
        }

        return currentIndex + 1;
      });
    }, STEP_DURATION_MS / speed);

    return () => window.clearInterval(timer);
  }, [maxIndex, playing, speed, trace]);

  const goToStep = useCallback(
    (nextIndex: number) => {
      setStepIndex(clamp(nextIndex, maxIndex));
    },
    [maxIndex],
  );

  const next = useCallback(() => {
    setStepIndex((currentIndex) => clamp(currentIndex + 1, maxIndex));
  }, [maxIndex]);

  const previous = useCallback(() => {
    setStepIndex((currentIndex) => clamp(currentIndex - 1, maxIndex));
  }, [maxIndex]);

  const reset = useCallback(() => {
    setStepIndex(0);
    setPlaying(false);
  }, []);

  const timelineProgress = useMemo(() => {
    if (!trace || trace.steps.length <= 1) {
      return 0;
    }

    return stepIndex / (trace.steps.length - 1);
  }, [stepIndex, trace]);

  return {
    stepIndex,
    setStepIndex: goToStep,
    playing,
    setPlaying,
    speed,
    setSpeed,
    animationKey,
    isTransitioning,
    next,
    previous,
    reset,
    timelineProgress,
    maxIndex,
  };
}
