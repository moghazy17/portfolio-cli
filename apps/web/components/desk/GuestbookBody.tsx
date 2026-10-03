'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatRelative, GUESTBOOK_LIMITS, SIGN_MESSAGES, validateGuestbookEntry } from '@ahmed-moghazy/shared';
import type { GuestbookEntry, SignResult } from '@ahmed-moghazy/shared';
import Turnstile from '../Turnstile';

const MIN_SHOWN = 3;

export default function GuestbookBody() {
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [active, setActive] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(true);
  const onToken = useCallback((value: string | null) => {
    setToken(value);
    setCheckFailed(value === null);
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch('/api/guestbook', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw Error('Unavailable');
        return response.json() as Promise<{ entries: GuestbookEntry[] }>;
      })
      .then((data) => { if (mounted) setEntries(data.entries); })
      .catch(() => { if (mounted) setAvailable(false); });
    return () => { mounted = false; };
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const checked = validateGuestbookEntry({ name, message });
    if (!checked.ok) { setStatus(checked.message); return; }
    if (!token) { setStatus(SIGN_MESSAGES.human_check); return; }
    setBusy(true);
    setStatus('');
    try {
      const response = await fetch('/api/guestbook', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: checked.name, message: checked.message, turnstileToken: token }),
      });
      const signed = await response.json() as SignResult;
      if (!signed.ok) setStatus(signed.message);
      else {
        setEntries((current) => [signed.entry, ...current].slice(0, 20));
        setName('');
        setMessage('');
        setStatus(`Thanks for signing, ${signed.entry.name}!`);
      }
    } catch { setStatus(SIGN_MESSAGES.unavailable); }
    finally {
      setBusy(false);
      setToken(null);
      setAttempt((current) => current + 1);
    }
  };

  // A near-empty guestbook reads as an empty room; entries show once a few people have signed.
  const shown = entries.length >= MIN_SHOWN ? entries : [];
  return (
    <div className="be-guestbook">
      {available ? shown.length ? (
        <ul className="be-notes" aria-label="Entries">
          {shown.map((entry) => (
            <li key={entry.id}>
              <p className="be-note-who">{entry.name} <span>{formatRelative(entry.at)}</span></p>
              <p className="be-note-text">{entry.message}</p>
            </li>
          ))}
        </ul>
      ) : <p className="be-muted">Be one of the first to sign.</p>
        : <p className="be-muted">Guestbook unavailable right now.</p>}
      <form onSubmit={submit} className="be-form">
        <div className="be-field">
          <label htmlFor="guestbook-name">Your name</label>
          <input id="guestbook-name" className="be-input" value={name} maxLength={GUESTBOOK_LIMITS.name} autoComplete="nickname"
            onFocus={() => setActive(true)} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="be-field">
          <label htmlFor="guestbook-message">Message</label>
          <textarea id="guestbook-message" className="be-input" rows={3} value={message} maxLength={GUESTBOOK_LIMITS.message}
            onFocus={() => setActive(true)} onChange={(event) => setMessage(event.target.value)} />
          <p className="be-count be-num">{[...message].length} / {GUESTBOOK_LIMITS.message}</p>
        </div>
        <Turnstile active={active} attempt={attempt} onToken={onToken} />
        {active && !token && !checkFailed && <p className="be-muted">Checking you're human…</p>}
        {checkFailed && <p className="be-muted">{SIGN_MESSAGES.human_check}</p>}
        <div className="be-form-actions">
          <p aria-live="polite" role="status">{status}</p>
          <button type="submit" className="be-button be-button-default" disabled={!token || busy}>Sign guestbook</button>
        </div>
      </form>
    </div>
  );
}
