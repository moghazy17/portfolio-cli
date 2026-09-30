import { parse as parseToml } from 'smol-toml';
import { parse as parseYaml } from 'yaml';
import type { EvidenceItem } from './types';

type Match = Pick<EvidenceItem, 'match' | 'kind'>;
const values = (entries: unknown): string[] => entries && typeof entries === 'object' && !Array.isArray(entries)
  ? Object.keys(entries) : [];
const dependency = (line: string) => line.trim().match(/^([a-z0-9_.-]+)(?:\[[^\]]+\])?/i)?.[1];
const image = (value: string) => value.replace(/@.*$/, '').replace(/:[^/:]+$/, '');

export function parseManifest(path: string, content: string): Match[] {
  const name = path.split('/').at(-1) ?? path;
  try {
    let matches: string[] = [];
    let kind: EvidenceItem['kind'] = 'manifest';
    if (name === 'package.json') {
      const json = JSON.parse(content) as Record<string, unknown>;
      matches = ['dependencies', 'devDependencies', 'peerDependencies'].flatMap((key) => values(json[key]));
    } else if (/^requirements.*\.txt$/i.test(name)) {
      matches = content.split(/\r?\n/).filter((line) => !/^\s*(#|-r\b|--)/.test(line)).map(dependency).filter((v): v is string => Boolean(v));
    } else if (name === 'pyproject.toml') {
      const toml = parseToml(content) as Record<string, any>;
      const project = toml.project ?? {};
      const poetry = toml.tool?.poetry ?? {};
      matches = [...(project.dependencies ?? []), ...Object.values(project['optional-dependencies'] ?? {}).flat(),
        ...values(poetry.dependencies), ...Object.values(poetry.group ?? {}).flatMap((group: any) => values(group.dependencies))]
        .map(String).map(dependency).filter((v): v is string => Boolean(v) && v !== 'python');
    } else if (name === 'Pipfile') {
      const toml = parseToml(content) as Record<string, unknown>;
      matches = [...values(toml.packages), ...values(toml['dev-packages'])];
    } else if (/^environment\.ya?ml$/i.test(name)) {
      const yaml = parseYaml(content) as { dependencies?: Array<string | { pip?: string[] }> };
      matches = (yaml.dependencies ?? []).flatMap((item) => typeof item === 'string' ? [item] : item.pip ?? [])
        .map(dependency).filter((v): v is string => Boolean(v));
    } else if (name === 'go.mod') {
      matches = [...content.matchAll(/^\s*([^\s()]+)\s+v\d+[^\s]*/gm)].map((match) => match[1]);
    } else if (name === 'Cargo.toml') {
      const toml = parseToml(content) as Record<string, unknown>;
      matches = [...values(toml.dependencies), ...values(toml['dev-dependencies'])];
    } else if (name === 'pom.xml') {
      kind = 'build';
      matches = [...content.matchAll(/<dependency>\s*<groupId>([^<]+)<\/groupId>\s*<artifactId>([^<]+)<\/artifactId>/g)]
        .map((match) => `${match[1]}:${match[2]}`);
    } else if (/^build\.gradle(?:\.kts)?$/.test(name)) {
      kind = 'build';
      matches = [...content.matchAll(/(?:implementation|api|compileOnly|runtimeOnly|testImplementation)\s*\(?\s*['"]([^:'"]+:[^:'"]+):[^'"]+['"]/g)]
        .map((match) => match[1]);
    } else if (/^(?:Dockerfile|.*\.Dockerfile)$/i.test(name)) {
      kind = 'container';
      matches = [...content.matchAll(/^\s*FROM\s+(?:--\S+\s+)?([^\s]+)/gim)].map((match) => image(match[1]));
    } else if (/^(?:docker-compose.*|compose)\.ya?ml$/i.test(name)) {
      kind = 'container';
      const yaml = parseYaml(content) as { services?: Record<string, { image?: string }> };
      matches = Object.values(yaml.services ?? {}).flatMap((service) => service?.image ? [image(service.image)] : []);
    } else if (path.includes('.github/workflows/') && /\.ya?ml$/.test(name)) {
      kind = 'workflow';
      matches = [...content.matchAll(/^\s*(?:-\s*)?uses:\s*['"]?([^\s'"@]+)/gm)].map((match) => match[1]);
    }
    return [...new Set(matches)].sort().map((match) => ({ match, kind }));
  } catch {
    return [];
  }
}
