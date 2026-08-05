// Loads the wasm-bindgen engine. The wrapper is intentionally loaded via a
// dynamic require (never bundled) so its internal __dirname resolves the
// sibling .wasm file, which esbuild would otherwise relocate.
import path from 'node:path';

type WasmEngine = {
  AixReaderWasm: new (data: Uint8Array) => AixReaderInstance;
  pack_aix: (
    files: AixInputFile[],
    buildId: string,
    engine: string,
    optimize: unknown,
  ) => AixPackResult;
  optimize_aix: (data: Uint8Array, options: unknown) => AixPackResult;
};

export type AixInputFile = { path: string; data: Uint8Array };

export type AixEntry = { name: string; size: number; compressed_size: number };

export type AixReaderInstance = {
  list: () => AixEntry[];
  read_file: (name: string) => Uint8Array;
  get_version: () => string | undefined;
  get_title: () => string | undefined;
  supports_engine: (version: string) => boolean;
  get_pages: () => unknown[];
  get_tools: () => unknown[];
};

type FileOptimizeReport = {
  path: string;
  status: 'optimized' | 'unchanged' | 'skipped';
  original_size: number;
  output_size: number;
  saved_bytes: number;
  converted_to_utf8: boolean;
};

export type OptimizeReport = {
  files: FileOptimizeReport[];
  original_size: number;
  output_size: number;
  saved_bytes: number;
};

export type AixPackResult = { data: Uint8Array; report: OptimizeReport };

let cached: WasmEngine | undefined;

export function loadEngine(): WasmEngine {
  if (cached) {
    return cached;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  cached = require(path.join(__dirname, 'pkg', 'aix_web.js')) as WasmEngine;
  return cached;
}