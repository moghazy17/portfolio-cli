import type { LiveServices } from '@ahmed-moghazy/shared';
import { listEntries } from './guestbook';
import { count } from './presence';

export const serverLiveServices: LiveServices = {
  async presence() {
    const value = await count();
    if (!value) throw new Error('Presence unavailable');
    return value;
  },
  async guestbook() {
    const value = await listEntries();
    if (!value) throw new Error('Guestbook unavailable');
    return value;
  },
};
