import type { DiffFile, SkipReason } from './types';

const LOCKFILES = new Set([
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'bun.lock',
  'Cargo.lock',
  'Gemfile.lock',
  'poetry.lock',
  'Pipfile.lock',
  'uv.lock',
  'composer.lock',
  'go.sum',
  'flake.lock',
  'packages.lock.json',
  'Podfile.lock',
  'mix.lock',
]);

const GENERATED_PATTERNS: RegExp[] = [
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)\.next\//,
  /(^|\/)vendor\//,
  /(^|\/)node_modules\//,
  /(^|\/)__snapshots__\//,
  /\.snap$/,
  /\.min\.(js|css)$/,
  /\.map$/,
  /\.generated\.\w+$/,
  /\.g\.dart$/,
  /\.pb\.go$/,
  /_pb2\.py$/,
  /(^|\/)CHANGELOG\.md$/,
];

const BINARY_EXTENSIONS =
  /\.(png|jpe?g|gif|webp|avif|ico|bmp|pdf|zip|gz|tgz|woff2?|ttf|otf|eot|mp3|mp4|mov|wasm|jar|exe|dll|so|dylib)$/i;

export function basename(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? path : path.slice(index + 1);
}

/** Why a file is left out of the review by default, or undefined when it should be reviewed. */
export function defaultSkipReason(
  file: Pick<DiffFile, 'path' | 'isBinary' | 'status' | 'hunks'>,
): SkipReason | undefined {
  if (file.isBinary || BINARY_EXTENSIONS.test(file.path)) return 'binary';
  if (LOCKFILES.has(basename(file.path))) return 'lockfile';
  if (GENERATED_PATTERNS.some((pattern) => pattern.test(file.path))) return 'generated';
  if (file.status === 'deleted') return 'deleted';
  return undefined;
}

export const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  lockfile: 'Lockfile',
  generated: 'Generated',
  binary: 'Binary',
  deleted: 'Deleted',
};
