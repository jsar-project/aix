import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadEngine, AixInputFile, AixPackResult } from './wasm';
import { walkDirectory, WalkedFile } from './walk';

function formatSize(bytes: number): string {
  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;
  if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(2)} MB`;
  if (bytes >= KB) return `${(bytes / KB).toFixed(2)} KB`;
  return `${bytes} bytes`;
}

function printError(message: string): never {
  process.stderr.write(`error: ${message}\n`);
  process.exit(1);
}

function readFileAsBytes(filePath: string): Uint8Array {
  return new Uint8Array(fs.readFileSync(filePath));
}

function writeOutput(data: Uint8Array, outputPath: string) {
  fs.writeFileSync(outputPath, Buffer.from(data));
}

async function cmdPack(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      o: { type: 'string', short: 'o' },
      O: { type: 'boolean', short: 'O' },
      'opt-level': { type: 'string', default: '2' },
      engine: { type: 'string', default: '*' },
    },
  });
  if (positionals.length !== 1) {
    printError('pack requires an input directory');
  }
  const inputDir = positionals[0];
  const outputPath = values.o ?? 'bundle.aix';
  const optimize = values.O;
  const optLevel = Number(values['opt-level']);
  const engine = values.engine;

  const files = walkDirectory(inputDir);
  const engineApi = loadEngine();

  const optimizeArg = optimize
    ? { level: optLevel, json: true, png: true, jpeg: true }
    : null;

  const inputFiles: AixInputFile[] = files.map((f: WalkedFile) => ({
    path: f.path,
    data: f.data,
  }));

  const buildId = crypto.randomUUID();
  const result: AixPackResult = engineApi.pack_aix(
    inputFiles,
    buildId,
    engine,
    optimizeArg,
  );

  writeOutput(result.data, outputPath);

  for (const file of result.report.files) {
    if (file.converted_to_utf8) {
      process.stdout.write(`Converted ${file.path} to UTF-8 for packaging\n`);
    } else if (file.status === 'optimized') {
      process.stdout.write(
        `Optimized ${file.path}: ${formatSize(file.original_size)} -> ${formatSize(file.output_size)} (saved ${formatSize(file.saved_bytes)})\n`,
      );
    } else if (file.path !== 'VERSION') {
      process.stdout.write(`Adding file: ${file.path}\n`);
    }
  }

  const finalSize = fs.statSync(outputPath).size;
  process.stdout.write(
    `Package created: ${outputPath} (${formatSize(finalSize)})\n`,
  );
  if (optimize && result.report.original_size > 0) {
    const ratio =
      (result.report.saved_bytes / result.report.original_size) * 100;
    process.stdout.write(
      `Optimization Summary: Total saved ${formatSize(result.report.saved_bytes)} (${ratio.toFixed(2)}%)\n`,
    );
  }
}

function cmdList(args: string[]) {
  const { positionals } = parseArgs({ args, allowPositionals: true });
  if (positionals.length !== 1) {
    printError('list requires an .aix file');
  }
  const filePath = positionals[0];
  const engineApi = loadEngine();
  const reader = new engineApi.AixReaderWasm(readFileAsBytes(filePath));

  process.stdout.write(`Contents of ${filePath}:\n`);
  for (const entry of reader.list()) {
    process.stdout.write(
      `${entry.name}: ${formatSize(entry.size)} (compressed: ${formatSize(entry.compressed_size)})\n`,
    );
  }
}

function cmdOptimize(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      o: { type: 'string', short: 'o' },
      level: { type: 'string', default: '2' },
    },
  });
  if (positionals.length !== 1) {
    printError('optimize requires an .aix file');
  }
  if (!values.o) {
    printError('optimize requires an output path (-o)');
  }
  const inputPath = positionals[0];
  const outputPath = values.o;
  const level = Number(values.level);

  const engineApi = loadEngine();
  const result = engineApi.optimize_aix(readFileAsBytes(inputPath), {
    level,
    json: true,
    png: true,
    jpeg: true,
  });

  writeOutput(result.data, outputPath);
  process.stdout.write(
    `Optimized ${inputPath} to ${outputPath} (saved ${formatSize(result.report.saved_bytes)})\n`,
  );
}

function usage() {
  process.stdout.write(
    [
      'aix - AIX package manager',
      '',
      'Usage:',
      '  aix pack <INPUT_DIR> [-o OUTPUT] [-O] [--opt-level N] [--engine RANGE]',
      '  aix list <AIX_FILE>   (alias: aix ls <AIX_FILE>)',
      '  aix optimize <AIX_FILE> -o <OUTPUT> [--level N]',
      '',
    ].join('\n'),
  );
}

const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'pack':
    void cmdPack(args);
    break;
  case 'list':
  case 'ls':
    cmdList(args);
    break;
  case 'optimize':
    cmdOptimize(args);
    break;
  default:
    usage();
}