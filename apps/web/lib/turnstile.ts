let warned = false;

export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') return false;
    if (!warned) {
      console.warn('[guestbook] TURNSTILE_SECRET_KEY is unset; allowing local signatures');
      warned = true;
    }
    return true;
  }
  if (!token) return false;
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return false;
    const data: unknown = await response.json();
    return !!data && typeof data === 'object' && 'success' in data && data.success === true;
  } catch {
    return false;
  }
}
