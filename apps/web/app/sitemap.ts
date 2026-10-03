import type { MetadataRoute } from 'next';

const origin = 'https://moghazy.me';

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${origin}/` }, { url: `${origin}/terminal` }];
}
