import type { GitHubStats } from './github';

// ============================================================
// CV DATA TYPES
// ============================================================

export interface ContactInfo {
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  location: string;
}

export interface Education {
  degree: string;
  institution: string;
  faculty: string;
  location: string;
  gpa: string;
  startDate: string;
  endDate: string;
  coursework: string[];
}

export interface WorkExperience {
  company: string;
  shortName: string;
  role: string;
  startDate: string;
  endDate: string;
  bullets: string[];
}

export interface Project {
  name: string;
  shortName: string;
  techStack: string;
  startDate: string;
  endDate: string;
  isGraduation: boolean;
  bullets: string[];
}

export interface Certification {
  title: string;
  issuer: string;
  startDate: string;
  endDate: string;
  bullets: string[];
}

export interface SkillCategory {
  name: string;
  skills: string[];
}

export interface CVData {
  name: string;
  professionalSummary: string;
  contact: ContactInfo;
  education: Education;
  experience: WorkExperience[];
  projects: Project[];
  certifications: Certification[];
  skills: SkillCategory[];
}

// ============================================================
// COMMAND OUTPUT TYPES
// ============================================================

export type CommandOutput =
  | TextOutput
  | SectionOutput
  | ListOutput
  | TableOutput
  | AsciiOutput
  | LinkOutput
  | DividerOutput
  | ErrorOutput
  | ProgressOutput
  | LinesOutput;

export interface TextOutput {
  type: 'text';
  content: string;
  style?: OutputStyle;
}

export interface SectionOutput {
  type: 'section';
  title: string;
  children: CommandOutput[];
  item?: string;
}

export interface ListOutput {
  type: 'list';
  items: string[];
  ordered?: boolean;
  style?: OutputStyle;
}

export interface TableOutput {
  type: 'table';
  headers: string[];
  rows: string[][];
}

export interface AsciiOutput {
  type: 'ascii';
  content: string;
  style?: OutputStyle;
}

export interface LinkOutput {
  type: 'link';
  text: string;
  url: string;
}

export interface DividerOutput {
  type: 'divider';
}

export interface ErrorOutput {
  type: 'error';
  content: string;
}

export interface ProgressOutput {
  type: 'progress';
  label: string;
  value: number;
  note?: string;
  reveal?: boolean;
}

export interface LinesOutput {
  type: 'lines';
  lines: Line[];
  showItems?: boolean;
}

export interface Line {
  text: string;
  style?: OutputStyle;
  item?: string;
  href?: string;
}

export interface OutputStyle {
  color?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
}

// ============================================================
// COMMAND REGISTRY TYPES
// ============================================================

export type Surface = 'web' | 'ssh' | 'curl';

export interface PresenceCount {
  total: number;
  bySurface: { web: number; ssh?: number };
  at: string;
}

export interface GuestbookEntry {
  id: string;
  name: string;
  message: string;
  at: string;
}

export type SignReason = 'empty' | 'too_long' | 'link' | 'contact' | 'blocked'
  | 'human_check' | 'rate_limited' | 'daily_cap' | 'unavailable' | 'bad_request';

export type SignResult =
  | { ok: true; entry: GuestbookEntry }
  | { ok: false; reason: SignReason; message: string };

export type SkillEvidence = Record<string, number>;

export interface LiveServices {
  presence(signal: AbortSignal): Promise<PresenceCount>;
  guestbook(signal: AbortSignal): Promise<GuestbookEntry[]>;
}

export type CompletionSource =
  | 'projects' | 'experience' | 'skills' | 'themes' | 'open-targets'
  | 'commands' | 'path' | 'dir';

export interface ArgSpec {
  positional?: Array<{ name: string; required?: boolean; variadic?: boolean; complete?: CompletionSource }>;
  flags?: FlagSpec[];
}

export interface FlagSpec {
  short?: string;
  long?: string;
  value?: 'number' | 'string';
  description: string;
}

export interface ManPage {
  summary?: string;
  description: string;
  examples: string[];
  seeAlso?: string[];
}

export interface CommandDefinition {
  name: string;
  description: string;
  usage: string;
  aliases: string[];
  kind?: 'command' | 'filter';
  hidden?: boolean;
  menu?: boolean;
  /** Whether the assistant may execute this command. */
  assistant?: boolean;
  /** Treat input with arguments as unknown input; bare invocations still run this command. */
  bareOnly?: boolean;
  surfaces?: Surface[];
  args?: ArgSpec;
  man?: ManPage;
  execute: (ctx: CommandContext) => CommandResult | Promise<CommandResult>;
}

export interface CommandContext {
  args: string[];
  flags: Record<string, string | boolean>;
  argv: string[];
  session: ShellSession;
  surface: Surface;
  origin: string;
  signal: AbortSignal;
  fs: FileSystem;
  github?: (signal: AbortSignal) => Promise<GitHubStats>;
  live?: LiveServices;
  skillEvidence?: (signal: AbortSignal) => Promise<SkillEvidence>;
  stdin?: Line[];
}

export interface CommandResult {
  output: CommandOutput[];
  status?: 'ok' | 'error';
  notFound?: true;
  clear?: boolean;
  mode?: 'chat';
  openUrl?: string;
  theme?: string;
  welcome?: boolean;
  download?: { url: string; filename: string };
  sequence?: SequenceStep[];
  /** Ask the host to answer an unknown input through the assistant. */
  ask?: { question: string };
  view?: 'gui';
  sign?: { name: string; message: string };
  tour?: TourStep[];
}

export interface Suggestion {
  label: string;
  line: string;
  kind: 'command' | 'question';
}

export interface TourStep {
  line: string;
  pauseMs: number;
  motion?: true;
}

export interface SequenceStep {
  delayMs: number;
  output: CommandOutput[];
}

export interface ShellResult extends CommandResult {
  cancelled?: boolean;
}

export type VfsPath = string;

export interface ShellSession {
  cwd: VfsPath;
  lastStatus: 'ok' | 'error';
}

export interface UnknownInput {
  raw: string;
  word: string;
  suggestion?: string;
}

export type UnknownCommandHandler = (
  input: UnknownInput,
  ctx: Omit<CommandContext, 'args' | 'flags' | 'argv'>,
) => CommandResult | Promise<CommandResult>;

export type VfsNode = VfsDir | VfsFile;

export interface VfsDir {
  kind: 'dir';
  name: string;
  path: VfsPath;
  children: VfsNode[];
}

export interface VfsFile {
  kind: 'file';
  name: string;
  path: VfsPath;
  size: number;
  binary?: boolean;
  render: () => CommandOutput[];
}

export interface FileSystem {
  root: VfsDir;
  resolve(cwd: VfsPath, input: string): { node?: VfsNode; path: VfsPath; error?: 'ENOENT' | 'ENOTDIR' };
  display(path: VfsPath): string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface HistoryEntry {
  input: string;
  output: CommandOutput[];
  prompt?: string;
}

// ============================================================
// THEME TYPES
// ============================================================

export interface Theme {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  dimmed: string;
  error: string;
  success: string;
  effects?: { crt?: boolean };
}
