import path from "node:path";
import { parseArgs } from "node:util";
import { renderPreviewHtml } from "./html";
import { startDevPreviewServer, startStaticPreviewServer } from "./server";
import {
  buildPreviewInkImportMap,
  getRemoteCurrentRuntimeVersion,
  listPublishedRuntimeVersions,
} from "../services/runtime-registry";
import { readRuntimeSelection } from "../services/runtime-selection";
import { withLoading } from "../ui/status";
import { buildPreviewState } from "./state";
import {
  installSignalHandlers,
  openInBrowser,
  writeHtmlOutput,
} from "./utils";
import type { PreviewTarget } from "./types";

export async function cmdPreview(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      "html-out": { type: "string" },
      dev: { type: "boolean", default: false },
      launch: { type: "boolean", default: false },
      "launch-target": { type: "string", default: "blank" },
    },
  });

  if (positionals.length !== 1) {
    throw new Error("preview requires an input file or directory");
  }
  if (values["launch-target"] !== "blank" && values["launch-target"] !== "current") {
    throw new Error('--launch-target must be either "blank" or "current"');
  }
  const launchTarget = values["launch-target"] as PreviewTarget;

  if (values.dev && values["html-out"]) {
    throw new Error("--html-out cannot be used with --dev");
  }

  if (values.launch && values["html-out"]) {
    throw new Error("--launch cannot be used with --html-out");
  }

  const inputPath = path.resolve(positionals[0]);
  const htmlOut = values["html-out"];
  const previewRuntime = await resolvePreviewRuntime();

  if (values.dev) {
    const preview = await startDevPreviewServer(
      inputPath,
      previewRuntime.version,
      previewRuntime.importMap,
    );
    installSignalHandlers(() => preview.close());
    process.stdout.write(`Preview dev server running at ${preview.url}\n`);
    process.stdout.write("Press Ctrl+C to stop preview.\n");
    if (values.launch) {
      openInBrowser(`${preview.url}?target=${launchTarget}`);
    }
    return;
  }

  const state = buildPreviewState(inputPath);
  const html = renderPreviewHtml({
    mode: "static",
    sourceLabel: state.sourceName,
    inkRuntimeVersion: previewRuntime.version,
    inkImportMap: previewRuntime.importMap,
    title: state.title,
    version: state.version,
    fileCount: state.files.length,
    initialState: state,
  });

  if (htmlOut) {
    const outputPath = path.resolve(process.cwd(), htmlOut);
    writeHtmlOutput(outputPath, html);
    process.stdout.write(`Preview HTML created: ${outputPath}\n`);
    return;
  }

  const preview = await startStaticPreviewServer(html);
  installSignalHandlers(() => preview.close());
  process.stdout.write(`Preview server running at ${preview.url}\n`);
  process.stdout.write("Press Ctrl+C to stop preview.\n");
  if (values.launch) {
    openInBrowser(`${preview.url}?target=${launchTarget}`);
  }
}

async function resolvePreviewRuntime(): Promise<{
  version: string;
  importMap: { imports: Record<string, string> };
}> {
  const selectedVersion = readRuntimeSelection()?.selectedVersion;
  if (selectedVersion) {
    const publishedVersions = await withLoading(
      "Resolving preview runtime version...",
      async () => await listPublishedRuntimeVersions(),
    );
    if (publishedVersions.includes(selectedVersion)) {
      return {
        version: selectedVersion,
        importMap: buildPreviewInkImportMap(selectedVersion),
      };
    }

    const remoteCurrentVersion = await withLoading(
      "Resolving preview runtime version...",
      async () => await getRemoteCurrentRuntimeVersion(),
    );
    return {
      version: remoteCurrentVersion,
      importMap: buildPreviewInkImportMap(remoteCurrentVersion),
    };
  }

  const remoteCurrentVersion = await withLoading(
    "Resolving preview runtime version...",
    async () => await getRemoteCurrentRuntimeVersion(),
  );
  return {
    version: remoteCurrentVersion,
    importMap: buildPreviewInkImportMap(remoteCurrentVersion),
  };
}
