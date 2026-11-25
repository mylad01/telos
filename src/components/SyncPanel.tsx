'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { SyncAccount, SyncStatus } from '@/lib/useSync';

type BackupMessage = { kind: 'ok' | 'error'; text: string } | null;
type AuthResult = string | null;

export function SyncPanel({
  enabled,
  account,
  status,
  pending,
  lastSyncedAt,
  onSignIn,
  onSignUp,
  onSignOut,
  onExport,
  onImport,
  backupMessage,
}: {
  enabled: boolean;
  account: SyncAccount;
  status: SyncStatus;
  pending: number;
  lastSyncedAt: number | null;
  onSignIn: (email: string, password: string) => Promise<AuthResult>;
  onSignUp: (email: string, password: string) => Promise<AuthResult>;
  onSignOut: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  backupMessage: BackupMessage;
}) {
  const t = useTranslations('sync');
  const tb = useTranslations('backup');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const timeFormat = useMemo(
    () => new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }),
    [],
  );

  const statusText = (() => {
    if (!account) return t('statusLocal');
    if (status === 'syncing') return t('statusSyncing');
    if (status === 'offline') return t('statusOffline');
    if (status === 'error') return t('statusError');
    if (pending > 0) return t('statusPending', { count: pending });
    if (lastSyncedAt) return t('statusSynced', { time: timeFormat.format(new Date(lastSyncedAt)) });
    return t('statusLocal');
  })();

  const errorText = (code: string | null) => {
    if (!code) return null;
    if (code === 'exists') return t('errorExists');
    if (code === 'password') return t('errorPassword');
    if (code === 'email') return t('errorEmail');
    if (code === 'network') return t('errorNetwork');
    return t('errorInvalid');
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = mode === 'signup' ? await onSignUp(email, password) : await onSignIn(email, password);
    setBusy(false);
    if (result) {
      setError(result);
      return;
    }
    setPassword('');
  }

  function switchMode() {
    setMode((current) => (current === 'signin' ? 'signup' : 'signin'));
    setError(null);
  }

  return (
    <section className="panel" aria-labelledby="sync-title">
      {enabled && (
        <div className="panel-block">
          <div className="panel-head">
            <h2 id="sync-title">{t('title')}</h2>
            <span className="panel-status" data-state={status}>
              <span className="status-dot" aria-hidden="true" />
              {statusText}
            </span>
          </div>

          {account ? (
            <div className="panel-signed">
              <p className="signed-email">{t('signedInAs', { email: account.email })}</p>
              <button type="button" className="panel-button" onClick={onSignOut}>
                {t('signOut')}
              </button>
            </div>
          ) : (
            <form className="panel-form" onSubmit={submit}>
              <p className="panel-blurb">{t('blurb')}</p>
              <div className="field">
                <label htmlFor="sync-email">{t('email')}</label>
                <input
                  id="sync-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="sync-password">{t('password')}</label>
                <input
                  id="sync-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  minLength={8}
                  required
                />
              </div>
              {error && (
                <p className="panel-note is-error" role="alert">
                  {errorText(error)}
                </p>
              )}
              <div className="panel-actions">
                <button type="submit" className="panel-button is-primary" disabled={busy}>
                  {mode === 'signup' ? t('createAccount') : t('signIn')}
                </button>
                <button type="button" className="link-button" onClick={switchMode}>
                  {mode === 'signup' ? t('switchToSignIn') : t('switchToSignUp')}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="panel-block">
        <h2 className="panel-title">{tb('title')}</h2>
        <p className="panel-blurb">{tb('blurb')}</p>
        <div className="panel-actions">
          <button type="button" className="panel-button" onClick={onExport}>
            {tb('export')}
          </button>
          <label className="panel-button file-button">
            {tb('import')}
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onImport(file);
                event.target.value = '';
              }}
            />
          </label>
        </div>
        {backupMessage && (
          <p className={`panel-note${backupMessage.kind === 'error' ? ' is-error' : ''}`} role="status">
            {backupMessage.text}
          </p>
        )}
      </div>
    </section>
  );
}
