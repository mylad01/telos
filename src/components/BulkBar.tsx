'use client';

import { useTranslations } from 'next-intl';

type BulkBarProps = {
  value: string;
  onChange(v: string): void;
  onSubmit(): void;
  result: string | null;
  busy?: boolean;
};

export function BulkBar({ value, onChange, onSubmit, result, busy = false }: BulkBarProps) {
  const t = useTranslations('bulk');
  const empty = value.trim().length === 0;

  return (
    <form
      className="bulk-bar"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && !empty) onSubmit();
      }}
    >
      <input
        className="bulk-input"
        type="text"
        name="bulk"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('placeholder')}
        aria-label={t('label')}
        autoComplete="off"
        disabled={busy}
      />
      <button
        className="bulk-submit"
        type="submit"
        disabled={busy || empty}
        aria-label={t('submit')}
      >
        {busy ? t('busy') : t('submit')}
      </button>
      <p className="bulk-result" role="status" aria-live="polite">
        {result ?? ''}
      </p>
    </form>
  );
}
