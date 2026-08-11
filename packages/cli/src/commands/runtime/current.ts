import { getCurrentRuntimeVersion } from "../../services/runtime-registry";
import { readRuntimeSelection } from "../../services/runtime-selection";
import { withLoading } from "../../ui/status";

export async function cmdRuntimeCurrent(): Promise<void> {
  const selectedVersion = readRuntimeSelection()?.selectedVersion;
  if (selectedVersion) {
    process.stdout.write(`${selectedVersion}\n`);
    return;
  }

  const currentVersion = await withLoading(
    "Resolving current runtime version...",
    async () => await getCurrentRuntimeVersion(),
  );
  process.stdout.write(`${currentVersion}\n`);
}
