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
  | DividerOutput;

export interface TextOutput {
  type: 'text';
  content: string;
  style?: OutputStyle;
}

export interface SectionOutput {
  type: 'section';
  title: string;
  children: CommandOutput[];
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

export interface OutputStyle {
  color?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
}

// ============================================================
// COMMAND REGISTRY TYPES
// ============================================================

export interface CommandDefinition {
  name: string;
  description: string;
  usage: string;
  aliases: string[];
  execute: (args: string[]) => CommandResult;
}

export interface CommandResult {
  output: CommandOutput[];
  clear?: boolean;
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
}
