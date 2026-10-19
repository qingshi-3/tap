/**
 * Ambient declarations for the handful of Node built-ins used ONLY by the
 * temporary renderer self-test (`__selftest__.ts`, `fixture-manifest.ts`,
 * `png.ts`). The game bundle never imports these; `@types/node` is deliberately
 * not a dependency of this package.
 */
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: string): string;
  export function writeFileSync(path: string, data: string | Uint8Array): void;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
}

declare module 'node:path' {
  export function dirname(path: string): string;
  export function resolve(...parts: string[]): string;
  export function join(...parts: string[]): string;
}

declare module 'node:url' {
  export function fileURLToPath(url: string): string;
}

declare module 'node:zlib' {
  export function deflateSync(data: Uint8Array, options?: { level?: number }): Uint8Array;
}

declare const process: {
  argv: string[];
  exitCode?: number;
  platform: string;
  cwd(): string;
  env: Record<string, string | undefined>;
};

declare const __dirname: string;
declare const __filename: string;
