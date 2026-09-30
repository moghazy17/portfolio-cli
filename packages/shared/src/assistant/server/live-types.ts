export interface LiveRepo {
  name: string;
  fork: boolean;
  topics: string[];
  pushedAt: string;
  archived: boolean;
}

export interface LiveRepoDetail extends LiveRepo {
  url: string;
  description: string | null;
  languages: string[];
  /** Redacted, at most 3,000 characters. */
  readmeExcerpt: string | null;
}

export interface RecentActivity {
  repo: string;
  lastActivity: string;
  pushes: number;
  kinds: Array<'push' | 'created' | 'release' | 'public'>;
}

export interface CodeHit {
  repo: string;
  path: string;
  /** Redacted, at most 160 characters. */
  fragment: string;
}
