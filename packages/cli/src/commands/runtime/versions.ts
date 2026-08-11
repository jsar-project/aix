import { listRuntimeVersions } from "../../services/runtime-registry";
import { withLoading } from "../../ui/status";

export async function cmdRuntimeVersions(): Promise<void> {
  const info = await withLoading(
    "Loading runtime versions...",
    async () => await listRuntimeVersions(),
  );
  process.stdout.write(`Runtime source: ${info.sourceLabel}\n`);
  process.stdout.write(`Package: ${info.packageName}\n`);
  process.stdout.write(`Current: ${info.currentVersion}\n`);
  if (info.selectedVersion) {
    process.stdout.write(`Selected: ${info.selectedVersion}\n`);
  }
  process.stdout.write("\n");
  process.stdout.write("Versions:\n");
  for (const version of info.versions) {
    process.stdout.write(`- ${version}\n`);
  }
}
