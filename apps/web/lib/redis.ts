import { Redis } from '@upstash/redis';

// Vercel's Upstash integration creates KV_REST_API_* names; accept either,
// matching the fallback order of Redis.fromEnv().
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

// null when not configured — callers degrade gracefully
export const redis = url && token ? new Redis({ url, token }) : null;
