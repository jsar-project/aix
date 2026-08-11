import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const AIX_HOME_DIR = path.join(os.homedir(), ".aix");
const RUNTIME_SELECTION_FILE = path.join(AIX_HOME_DIR, "runtime.json");
const RUNTIME_SELECTION_DISPLAY_PATH = "~/.aix/runtime.json";

export type RuntimeSelection = {
  selectedVersion: string;
};

export function readRuntimeSelection(): RuntimeSelection | undefined {
  let content: string;
  try {
    content = fs.readFileSync(RUNTIME_SELECTION_FILE, "utf-8");
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }
    throw new Error(
      `failed to read local runtime selection from ${RUNTIME_SELECTION_DISPLAY_PATH}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(
      `failed to read local runtime selection from ${RUNTIME_SELECTION_DISPLAY_PATH}`,
    );
  }

  if (
    !parsed
    || typeof parsed !== "object"
    || typeof (parsed as { selectedVersion?: unknown }).selectedVersion !== "string"
  ) {
    return undefined;
  }

  const selectedVersion = (parsed as { selectedVersion: string }).selectedVersion.trim();
  if (selectedVersion.length === 0) {
    return undefined;
  }

  return { selectedVersion };
}

export function saveRuntimeSelection(selectedVersion: string): void {
  try {
    fs.mkdirSync(AIX_HOME_DIR, { recursive: true });
    fs.writeFileSync(
      RUNTIME_SELECTION_FILE,
      JSON.stringify({ selectedVersion }, null, 2) + "\n",
      "utf-8",
    );
  } catch {
    throw new Error(
      `failed to save runtime selection to ${RUNTIME_SELECTION_DISPLAY_PATH}`,
    );
  }
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error
    && (error as { code?: unknown }).code === "ENOENT");
}
