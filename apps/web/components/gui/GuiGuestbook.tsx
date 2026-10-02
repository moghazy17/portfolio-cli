'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatRelative, GUESTBOOK_LIMITS, SIGN_MESSAGES, validateGuestbookEntry } from '@ahmed-moghazy/shared';
import type { GuestbookEntry, SignResult } from '@ahmed-moghazy/shared';
import Turnstile from '../Turnstile';
import Section from './Section';

export default function GuiGuestbook() {
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

  return <Section id="guestbook" title="Guestbook" width="narrow">
    <div className="space-y-4">
      {available ? entries.length ? <ul className="space-y-3">
        {entries.map((entry) => <li key={entry.id} className="rounded-xl border border-border bg-card p-4">
          <p className="font-semibold">{entry.name} <span className="font-normal text-muted">· {formatRelative(entry.at)}</span></p>
          <p className="mt-1 whitespace-pre-wrap break-words">{entry.message}</p>
        </li>)}
      </ul> : <p className="text-muted">No entries yet — be the first to sign.</p>
        : <p className="text-muted">Guestbook unavailable right now.</p>}
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div>
          <label htmlFor="guestbook-name" className="mb-1 block font-medium">Your name</label>
          <input id="guestbook-name" value={name} maxLength={GUESTBOOK_LIMITS.name} onFocus={() => setActive(true)}
            onChange={(event) => setName(event.target.value)} className="min-h-11 w-full rounded-lg border border-border bg-bg px-3 text-fg" />
        </div>
        <div>
          <label htmlFor="guestbook-message" className="mb-1 block font-medium">Message</label>
          <textarea id="guestbook-message" value={message} maxLength={GUESTBOOK_LIMITS.message} onFocus={() => setActive(true)}
            onChange={(event) => setMessage(event.target.value)} className="min-h-28 w-full rounded-lg border border-border bg-bg p-3 text-fg" />
          <p className="text-right text-sm text-muted">{[...message].length} / {GUESTBOOK_LIMITS.message}</p>
        </div>
        <Turnstile active={active} attempt={attempt} onToken={onToken} />
        {active && !token && !checkFailed && <p className="text-sm text-muted">Checking you're human…</p>}
        {checkFailed && <p className="text-sm text-muted">{SIGN_MESSAGES.human_check}</p>}
        <button type="submit" disabled={!token || busy} className="min-h-11 rounded-lg bg-accent px-5 font-semibold text-on-accent disabled:cursor-not-allowed disabled:opacity-50">Sign guestbook</button>
        <p aria-live="polite" role="status" className="text-sm">{status}</p>
      </form>
    </div>
  </Section>;
}
