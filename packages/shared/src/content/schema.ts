import { z } from 'zod';

function receivedType(value: unknown) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function manualTextValue(value: unknown): string | undefined {
  if (
    typeof value !== 'object'
    || value === null
    || Array.isArray(value)
    || Object.keys(value).length !== 2
    || !('value' in value)
    || !('manual' in value)
    || value.manual !== true
    || typeof value.value !== 'string'
    || value.value.trim().length === 0
  ) {
    return undefined;
  }
  return value.value;
}

function textValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return manualTextValue(value);
}

const textError = (value: unknown) =>
  `expected a non-empty string, received ${receivedType(value)}`;

export const Text = z.unknown().superRefine((value, ctx) => {
  if (textValue(value) === undefined) {
    ctx.addIssue({ code: 'custom', message: textError(value) });
  }
}).transform((value) => textValue(value)!);

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
export const Month = z.unknown().superRefine((value, ctx) => {
  const text = textValue(value);
  if (text === undefined) {
    ctx.addIssue({ code: 'custom', message: textError(value) });
  } else if (!monthPattern.test(text)) {
    ctx.addIssue({
      code: 'custom',
      message: `expected YYYY-MM (e.g. 2025-10), received ${JSON.stringify(text)}`,
    });
  }
}).transform((value) => textValue(value)!);

export const Slug = z.string().regex(
  /^[a-z0-9]+(-[a-z0-9]+)*$/,
  'expected a lowercase kebab-case slug',
);

export const Url = z.url().refine(
  (value) => value.startsWith('https://'),
  'expected an absolute https:// URL',
);

function extensibleShape<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).catchall(z.unknown());
}

function dateOrder<T extends { startDate?: string; endDate?: string }>(
  value: T,
  ctx: z.RefinementCtx,
) {
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'endDate must be greater than or equal to startDate',
    });
  }
  if (!value.startDate && value.endDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'endDate requires startDate',
    });
  }
}

const profileSchema = extensibleShape({
  network: Text,
  url: Url,
  username: Text.optional(),
});

const educationSchema = extensibleShape({
  institution: Text,
  area: Text,
  studyType: Text,
  faculty: Text,
  location: Text,
  score: Text,
  startDate: Month,
  endDate: Month.optional(),
  courses: z.array(Text),
}).superRefine(dateOrder);

const workSchema = extensibleShape({
  slug: Slug,
  name: Text,
  position: Text,
  startDate: Month.optional(),
  endDate: Month.optional(),
  highlights: z.array(Text),
}).superRefine(dateOrder);

const projectSchema = extensibleShape({
  slug: Slug,
  name: Text,
  stack: Text,
  graduation: z.boolean().default(false),
  startDate: Month,
  endDate: Month.optional(),
  highlights: z.array(Text),
}).superRefine(dateOrder);

const certificateSchema = extensibleShape({
  name: Text,
  issuer: Text,
  startDate: Month,
  endDate: Month.optional(),
  highlights: z.array(Text),
}).superRefine(dateOrder);

const skillSchema = extensibleShape({
  name: Text,
  keywords: z.array(Text),
});

export const ResumeSchema = z.object({
  basics: extensibleShape({
    name: Text,
    label: Text,
    summary: Text,
    email: Text,
    phone: Text,
    location: extensibleShape({
      city: Text,
      countryCode: Text,
    }),
    profiles: z.array(profileSchema),
  }),
  education: z.array(educationSchema).min(1, 'expected at least one education entry'),
  work: z.array(workSchema),
  projects: z.array(projectSchema),
  certificates: z.array(certificateSchema),
  skills: z.array(skillSchema),
}).strict();

export const SiteSchema = z.object({
  title: Text,
  ogTitle: Text,
  description: Text,
  ogDescription: Text,
  twitterDescription: Text,
  keywords: z.array(Text),
}).strict();

export const WriteupFrontMatterSchema = z.object({
  featured: z.boolean().default(false),
  links: z.array(z.object({
    label: z.string().trim().min(1, 'expected a non-empty string'),
    url: Url,
  }).strict()).default([]),
}).strict();

export const TechAliasMapSchema = z.record(
  z.string().regex(/^[a-z0-9][a-z0-9+.#-]*$/),
  z.object({
    label: z.string().trim().min(1),
    category: z.enum(['language', 'ai', 'data', 'web', 'infra', 'tooling', 'other']),
    aliases: z.array(z.string().min(1).max(120).refine(
      (alias) => alias === alias.toLowerCase() && (alias.match(/\*/g)?.length ?? 0) <= 1,
      'alias must be lower-case with at most one glob',
    )),
  }).strict(),
);
export type TechAliasMap = z.output<typeof TechAliasMapSchema>;

export type ResumeInput = z.input<typeof ResumeSchema>;
export type Resume = z.output<typeof ResumeSchema>;
export type SiteInput = z.input<typeof SiteSchema>;
export type Site = z.output<typeof SiteSchema>;
export type WriteupFrontMatter = z.output<typeof WriteupFrontMatterSchema>;

export interface Content {
  schemaVersion: 1;
  resume: Resume;
  site: Site;
  writeups: Record<string, WriteupFrontMatter & { body: string }>;
  cv: {
    available: boolean;
    path: '/cv/latest.pdf';
  };
}
