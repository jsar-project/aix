import { Command } from "commander";
import { cmdOptimize, cmdList, cmdPack } from "./commands/legacy";
import { cmdRuntimeCurrent } from "./commands/runtime/current";
import { cmdRuntimeSelect } from "./commands/runtime/select";
import { cmdRuntimeVersions } from "./commands/runtime/versions";
import { cmdPreview } from "./preview";
import { formatError } from "./ui/status";

async function main() {
  const program = new Command();
  program
    .name("aix")
    .description("AIX package manager")
    .showHelpAfterError();

  program
    .command("pack <input-dir>")
    .description("Pack a directory into an .aix artifact")
    .option("-o, --output <output>", "Output file")
    .option("-O, --optimize", "Enable optimization")
    .option("--opt-level <level>", "Optimization level, 1-3", "2")
    .option("--engine <range>", "Supported engine range")
    .option("--log-time", "Prefix pack log lines with a local timestamp")
    .action(async (inputDir: string, options: {
      output?: string;
      optimize?: boolean;
      optLevel: string;
      engine?: string;
      logTime?: boolean;
    }) => {
      await cmdPack(buildPackArgs(inputDir, options));
    });

  program
    .command("list <aix-file>")
    .alias("ls")
    .description("List files inside an .aix artifact")
    .action((aixFile: string) => {
      cmdList([aixFile]);
    });

  program
    .command("optimize <aix-file>")
    .description("Optimize an existing .aix artifact")
    .requiredOption("-o, --output <output>", "Output file")
    .option("--level <level>", "Optimization level, 1-3", "2")
    .action((aixFile: string, options: { output: string; level: string }) => {
      cmdOptimize(buildOptimizeArgs(aixFile, options));
    });

  program
    .command("preview <input>")
    .description("Preview an .aix artifact or source directory")
    .option("--html-out <file>", "Write the preview HTML to a file")
    .option("--dev", "Start the preview server in development mode")
    .option("--launch", "Open the preview URL in the default browser")
    .option("--launch-target <target>", "Target for --launch: blank or current", "blank")
    .action(async (input: string, options: {
      htmlOut?: string;
      dev?: boolean;
      launch?: boolean;
      launchTarget: string;
    }) => {
      await cmdPreview(buildPreviewArgs(input, options));
    });

  const runtime = program
    .command("runtime")
    .description("Inspect available preview runtime versions")
    .action(() => {
      runtime.outputHelp();
    });

  runtime
    .command("versions")
    .description("List available preview runtime versions")
    .action(async () => {
      await cmdRuntimeVersions();
    });

  runtime
    .command("current")
    .description("Print the current default runtime version")
    .action(async () => {
      await cmdRuntimeCurrent();
    });

  runtime
    .command("select")
    .description("Select a runtime version interactively")
    .action(async () => {
      await cmdRuntimeSelect();
    });

  await program.parseAsync(process.argv);
}

function buildPackArgs(
  inputDir: string,
  options: {
    output?: string;
    optimize?: boolean;
    optLevel: string;
    engine?: string;
    logTime?: boolean;
  },
): string[] {
  const args = [inputDir];
  if (options.output) {
    args.push("-o", options.output);
  }
  if (options.optimize) {
    args.push("--optimize");
  }
  if (options.optLevel) {
    args.push("--opt-level", options.optLevel);
  }
  if (options.engine) {
    args.push("--engine", options.engine);
  }
  if (options.logTime) {
    args.push("--log-time");
  }
  return args;
}

function buildOptimizeArgs(
  aixFile: string,
  options: { output: string; level: string },
): string[] {
  return [aixFile, "-o", options.output, "--level", options.level];
}

function buildPreviewArgs(
  input: string,
  options: { htmlOut?: string; dev?: boolean; launch?: boolean; launchTarget: string },
): string[] {
  const args = [input];
  if (options.htmlOut) {
    args.push("--html-out", options.htmlOut);
  }
  if (options.dev) {
    args.push("--dev");
  }
  if (options.launch) {
    args.push("--launch");
  }
  args.push("--launch-target", options.launchTarget);
  return args;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${formatError(message)}\n`);
  process.exit(1);
});
