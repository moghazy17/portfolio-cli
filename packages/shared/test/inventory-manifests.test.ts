import { describe, expect, it } from 'vitest';
import { parseManifest } from '../src/inventory/manifests';

const cases: Array<[string, string, string[]]> = [
  ['package.json', '{"dependencies":{"react":"*"},"devDependencies":{"vitest":"*"},"peerDependencies":{"typescript":"*"}}', ['react', 'typescript', 'vitest']],
  ['requirements.txt', '# comment\nrequests[security]>=2; python_version>"3"\n-r other.txt\nfastapi==1', ['fastapi', 'requests']],
  ['pyproject.toml', '[project]\ndependencies = ["pandas>=2"]\n[project.optional-dependencies]\ntest = ["pytest>=8"]\n[tool.poetry.dependencies]\npython = "^3"\nnumpy = "*"', ['numpy', 'pandas', 'pytest']],
  ['Pipfile', '[packages]\nflask = "*"\n[dev-packages]\npytest = "*"', ['flask', 'pytest']],
  ['environment.yml', 'dependencies:\n  - numpy=1\n  - pip:\n    - requests>=2', ['numpy', 'requests']],
  ['go.mod', 'module example.com/x\nrequire (\n github.com/acme/lib v1.2.3\n)', ['github.com/acme/lib']],
  ['go.mod', 'module example.com/y\n\ngo 1.22\n\nrequire github.com/segmentio/kafka-go v0.4.47\nrequire github.com/acme/other v1.0.0 // indirect\nreplace github.com/acme/other => ../other\n', ['github.com/acme/other', 'github.com/segmentio/kafka-go']],
  ['Cargo.toml', '[dependencies]\nserde = "1"\n[dev-dependencies]\nproptest = "1"', ['proptest', 'serde']],
  ['pom.xml', '<dependency><groupId>org.apache.kafka</groupId><artifactId>kafka-clients</artifactId></dependency>', ['org.apache.kafka:kafka-clients']],
  ['build.gradle.kts', 'implementation("org.apache.kafka:kafka-clients:3.0")', ['org.apache.kafka:kafka-clients']],
  ['Dockerfile', 'FROM --platform=linux/amd64 python:3.12 AS build\nFROM alpine@sha256:abc', ['alpine', 'python']],
  ['compose.yaml', 'services:\n  db:\n    image: postgres:16', ['postgres']],
  ['.github/workflows/ci.yml', 'steps:\n  - uses: actions/checkout@v4', ['actions/checkout']],
];

describe('manifest parsers', () => {
  it.each(cases)('%s extracts dependencies', (path, source, expected) => {
    expect(parseManifest(path, source).map((item) => item.match)).toEqual(expected);
  });
  it('returns an empty result for malformed structured input', () => {
    for (const path of ['package.json', 'pyproject.toml', 'compose.yaml']) expect(parseManifest(path, '{')).toEqual([]);
  });
});
