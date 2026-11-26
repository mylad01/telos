'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ShareInvite, ShareRole } from '@/lib/share';

type Props = {
  list: string;
  invites: ShareInvite[];
  onInvite: (role: ShareRole) => void;
  onRevoke: (code: string) => void;
  onJoin: (code: string) => void;
  busy?: boolean;
};

export function SharePanel({ list, invites, onInvite, onRevoke, onJoin, busy = false }: Props) {
  const t = useTranslations('share');
  const [role, setRole] = useState<ShareRole>('editor');
  const [code, setCode] = useState('');

  return (
    <section className="share-panel" aria-labelledby="share-title">
      <header className="share-head">
        <h2 className="share-title" id="share-title">
          {t('title', { list })}
        </h2>
        <p className="share-blurb">{t('blurb')}</p>
      </header>

      <form
        className="share-form share-invite-form"
        onSubmit={(event) => {
          event.preventDefault();
          onInvite(role);
        }}
      >
        <label className="share-field">
          <span>{t('roleLabel')}</span>
          <select
            className="share-select"
            value={role}
            disabled={busy}
            onChange={(event) =>
              setRole(event.target.value === 'viewer' ? 'viewer' : 'editor')
            }
          >
            <option value="editor">{t('roleEditor')}</option>
            <option value="viewer">{t('roleViewer')}</option>
          </select>
        </label>
        <button className="share-button" type="submit" disabled={busy}>
          {t('invite')}
        </button>
      </form>

      <h3 className="share-subtitle">{t('invited')}</h3>
      {invites.length === 0 ? (
        <p className="share-empty">{t('empty')}</p>
      ) : (
        <ul className="share-invites">
          {invites.map((invite) => (
            <li className="share-invite" key={invite.id}>
              <span className="share-owner">{invite.ownerEmail || t('unknownOwner')}</span>
              <span className="share-role">
                {invite.role === 'editor' ? t('roleEditor') : t('roleViewer')}
              </span>
              <code className="share-code">{t('code', { code: invite.code })}</code>
              <button
                className="share-button share-button-quiet"
                type="button"
                disabled={busy}
                onClick={() => onRevoke(invite.code)}
              >
                {t('revoke')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="share-form share-join-form"
        onSubmit={(event) => {
          event.preventDefault();
          const value = code.trim().toUpperCase();
          if (!value) return;
          onJoin(value);
          setCode('');
        }}
      >
        <label className="share-field">
          <span>{t('joinLabel')}</span>
          <input
            className="share-input"
            value={code}
            maxLength={8}
            autoComplete="off"
            spellCheck={false}
            placeholder={t('joinPlaceholder')}
            disabled={busy}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        <button className="share-button" type="submit" disabled={busy || !code.trim()}>
          {t('join')}
        </button>
      </form>

      <p className="share-status" role="status" aria-live="polite">
        {busy ? t('busy') : t('statusCount', { count: invites.length })}
      </p>
    </section>
  );
}
