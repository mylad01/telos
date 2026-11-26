'use client';

import { useTranslations } from 'next-intl';
import { BREAK_MS, FOCUS_MS } from '@/lib/focus';

type FocusTimerProps = {
  taskTitle: string | null;
  remainingMs: number;
  phase: 'focus' | 'break';
  running: boolean;
  rounds: number;
  onStart(): void;
  onPause(): void;
  onResume(): void;
  onStop(): void;
};

function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = String(Math.floor(total / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function FocusTimer({
  taskTitle,
  remainingMs,
  phase,
  running,
  rounds,
  onStart,
  onPause,
  onResume,
  onStop,
}: FocusTimerProps) {
  const t = useTranslations('focus');
  const total = phase === 'focus' ? FOCUS_MS : BREAK_MS;
  const percent = Math.min(100, Math.max(0, (remainingMs / total) * 100));
  const paused = !running && remainingMs < total;

  return (
    <section className="focus-timer" aria-label={t('label')}>
      <div className="focus-head">
        <span className="focus-phase">
          {phase === 'focus' ? t('phase.focus') : t('phase.break')}
        </span>
        <span className="focus-rounds">{t('rounds', { count: rounds })}</span>
      </div>
      <p className="focus-task">{taskTitle ?? t('noTask')}</p>
      <span className="focus-time" role="timer" aria-live="polite">
        {t('time', { time: clock(remainingMs) })}
      </span>
      <div className="focus-track" aria-hidden="true">
        <div className="focus-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="focus-controls">
        {running ? (
          <button
            type="button"
            className="focus-button"
            onClick={onPause}
            aria-label={t('pause')}
          >
            {t('pause')}
          </button>
        ) : paused ? (
          <button
            type="button"
            className="focus-button"
            onClick={onResume}
            aria-label={t('resume')}
          >
            {t('resume')}
          </button>
        ) : (
          <button
            type="button"
            className="focus-button"
            onClick={onStart}
            disabled={taskTitle === null}
            aria-label={t('start')}
          >
            {t('start')}
          </button>
        )}
        <button
          type="button"
          className="focus-button focus-stop"
          onClick={onStop}
          disabled={taskTitle === null}
          aria-label={t('stop')}
        >
          {t('stop')}
        </button>
      </div>
    </section>
  );
}
