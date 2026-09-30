export { EXCLUDE_TOPIC, isExcludedRepo } from '../exclusion';

export const MANIFEST_PATTERNS = [
  'package.json', 'requirements*.txt', 'pyproject.toml', 'Pipfile',
  'environment.yml', 'environment.yaml', 'go.mod', 'Cargo.toml',
  'pom.xml', 'build.gradle', 'build.gradle.kts', 'Dockerfile', '*.Dockerfile',
  'docker-compose*.yml', 'docker-compose*.yaml', 'compose.yaml',
  '.github/workflows/*.yml', '.github/workflows/*.yaml',
];
export const SKIP_DIRS = ['node_modules', 'vendor', '.venv', 'dist', 'build'];
export const MAX_MANIFESTS_PER_REPO = 25;
export const SKIM_BYTES = 100_000;
export const SKIM_THRESHOLD = 200_000;
export const README_CHARS = 3000;
export const MIN_LANGUAGE_SHARE = 0.05;
export const MAX_SNAPSHOT_BYTES = 900_000;
export const STALE_AFTER_MS = 48 * 60 * 60 * 1000;
