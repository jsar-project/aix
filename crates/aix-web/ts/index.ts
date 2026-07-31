import init, { AixReaderWasm, optimize_aix, pack_aix } from '../dist/pkg/aix_web.js';

export interface AixInputFile {
  path: string;
  data: Uint8Array;
}

export interface OptimizeOptions {
  level?: 1 | 2 | 3;
  json?: boolean;
  png?: boolean;
  jpeg?: boolean;
}

export interface FileOptimizeReport {
  path: string;
  status: 'optimized' | 'unchanged' | 'skipped';
  original_size: number;
  output_size: number;
  saved_bytes: number;
  converted_to_utf8: boolean;
}

export interface OptimizeReport {
  files: FileOptimizeReport[];
  original_size: number;
  output_size: number;
  saved_bytes: number;
}

export interface PackResult {
  data: Uint8Array;
  report: OptimizeReport;
}

export interface AixEntry {
  name: string;
  size: number;
  compressed_size: number;
}

export interface PageInfo {
  name: string;
  title?: string;
  data_schema: any;
}

export interface Tool {
  type: string;
  function: {
    name: string;
    description?: string;
    parameters: any;
  };
}

export class AIX {
  private reader: AixReaderWasm;

  private constructor(reader: AixReaderWasm) {
    this.reader = reader;
  }

  /**
   * Initialize the WASM module and create an AIX instance from the given data.
   * @param data The .aix file content as Uint8Array or File
   */
  static async From(data: Uint8Array | File): Promise<AIX> {
    await init();
    let buffer: Uint8Array;
    if (data instanceof Uint8Array) {
      buffer = data;
    } else {
      const arrayBuffer = await data.arrayBuffer();
      buffer = new Uint8Array(arrayBuffer);
    }
    const reader = new AixReaderWasm(buffer);
    return new AIX(reader);
  }

  static async pack(
    files: AixInputFile[],
    options?: { buildId?: string; optimize?: false | OptimizeOptions },
  ): Promise<PackResult> {
    await init();
    const buildId = options?.buildId ?? crypto.randomUUID();
    const optimize = options?.optimize === false ? undefined : options?.optimize;
    const result = pack_aix(files, buildId, optimize);
    return { data: result.data, report: result.report as OptimizeReport };
  }

  static async optimize(
    data: Uint8Array | File,
    options?: OptimizeOptions,
  ): Promise<PackResult> {
    await init();
    const buffer = data instanceof Uint8Array
      ? data
      : new Uint8Array(await data.arrayBuffer());
    const result = optimize_aix(buffer, options);
    return { data: result.data, report: result.report as OptimizeReport };
  }

  /**
   * List all files in the AIX package.
   */
  list(): AixEntry[] {
    return this.reader.list() as AixEntry[];
  }

  /**
   * Read the content of a file from the AIX package.
   * @param name The name of the file
   */
  readFile(name: string): Uint8Array {
    return this.reader.read_file(name);
  }

  /**
   * Get the version metadata from the AIX package.
   */
  getVersion(): string | undefined {
    return this.reader.get_version();
  }

  /**
   * Get the title from app.json.
   */
  getTitle(): string | undefined {
    return (this.reader as any).get_title();
  }

  /**
   * Get all pages from app.json and pages/*.json.
   */
  getPages(): PageInfo[] {
    return (this.reader as any).get_pages() as PageInfo[];
  }

  /**
   * Get all tools from app.json and pages/*.json in OpenAI format.
   */
  getTools(): Tool[] {
    return (this.reader as any).get_tools() as Tool[];
  }
}
