import { select } from "@inquirer/prompts";
import { listRuntimeVersions } from "../../services/runtime-registry";
import { saveRuntimeSelection } from "../../services/runtime-selection";
import { withLoading } from "../../ui/status";

export async function cmdRuntimeSelect(): Promise<void> {
  const info = await withLoading(
    "Loading runtime versions...",
    async () => await listRuntimeVersions(),
  );
  const selectedVersion = await select<string>({
    message: "Select a preview runtime version",
    pageSize: 12,
    choices: info.versions.map((version: string) => ({
      value: version,
      name:
        version === info.selectedVersion
          ? `${version} (selected)`
          : version === info.currentVersion
            ? `${version} (current default)`
          : version,
    })),
  }).catch((error: unknown) => {
    if (isPromptCancellation(error)) {
      process.stderr.write("error: runtime selection cancelled\n");
      process.exit(130);
    }
    throw error;
  });

  saveRuntimeSelection(selectedVersion);
  process.stdout.write(`${selectedVersion}\n`);
}

function isPromptCancellation(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === "ExitPromptError";
}
