type TurnstileOptions = {
  sitekey: string;
  callback: (token: string) => void;
  'error-callback': () => void;
  'expired-callback': () => void;
};

interface TurnstileApi {
  render(element: HTMLElement, options: TurnstileOptions): string;
  remove(id: string): void;
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

const source = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = source;
    script.async = true;
    script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(Error('Turnstile unavailable'));
    script.onerror = () => reject(Error('Turnstile unavailable'));
    document.head.appendChild(script);
  }).catch((error) => { loading = null; throw error; });
  return loading;
}

export async function getTurnstileToken(): Promise<string> {
  const api = await Promise.race([
    loadTurnstile(),
    new Promise<never>((_, reject) => setTimeout(() => reject(Error('Human check timed out')), 10_000)),
  ]);
  return new Promise<string>((resolve, reject) => {
    const element = document.createElement('div');
    element.style.position = 'fixed';
    element.style.bottom = '1rem';
    element.style.right = '1rem';
    element.style.zIndex = '1000';
    document.body.appendChild(element);
    let id: string | null = null;
    let settled = false;
    const finish = (token?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (id) api.remove(id);
      element.remove();
      if (token) resolve(token); else reject(Error('Human check failed'));
    };
    const timer = setTimeout(() => finish(), 10_000);
    try {
      id = api.render(element, {
        sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA',
        callback: (token) => finish(token),
        'error-callback': () => finish(),
        'expired-callback': () => finish(),
      });
    } catch { finish(); }
  });
}
