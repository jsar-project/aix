import { readRuntimeSelection } from "./runtime-selection";

const RUNTIME_PACKAGE = "@yodaos-pkg/ink";
const RUNTIME_PACKAGE_ENCODED = "@yodaos-pkg%2Fink";
const ENV_NPM_REGISTRY = "AIX_NPM_REGISTRY";
const JSPM_PACKAGE_ENTRY_BASE_URL = "https://ga.jspm.io/npm:@yodaos-pkg/ink";

type RuntimeRegistryProvider = "npm" | "npmmirror";

type RuntimeRegistryConfig = {
  provider: RuntimeRegistryProvider;
  sourceLabel: string;
  registryUrl: string;
};

export type RuntimeRegistryInfo = {
  packageName: string;
  sourceLabel: string;
  currentVersion: string;
  selectedVersion?: string;
  versions: string[];
};

export async function getCurrentRuntimeVersion(): Promise<string> {
  const selectedVersion = readRuntimeSelection()?.selectedVersion;
  if (selectedVersion) {
    return selectedVersion;
  }
  return await getRemoteCurrentRuntimeVersion();
}

export async function listRuntimeVersions(): Promise<RuntimeRegistryInfo> {
  const config = getRuntimeRegistryConfig();
  const selectedVersion = readRuntimeSelection()?.selectedVersion;
  const [remoteCurrentVersion, versions] = await Promise.all([
    getRemoteCurrentRuntimeVersion(),
    listPublishedRuntimeVersions(),
  ]);

  return {
    packageName: RUNTIME_PACKAGE,
    sourceLabel: config.sourceLabel,
    currentVersion: selectedVersion ?? remoteCurrentVersion,
    selectedVersion,
    versions,
  };
}

export async function getRemoteCurrentRuntimeVersion(): Promise<string> {
  const config = getRuntimeRegistryConfig();
  return await getRemoteCurrentRuntimeVersionFromRegistry(config);
}

export async function listPublishedRuntimeVersions(): Promise<string[]> {
  const config = getRuntimeRegistryConfig();
  return await getPublishedRuntimeVersions(config);
}

export function buildPreviewInkModuleUrl(version: string): string {
  return `${JSPM_PACKAGE_ENTRY_BASE_URL}@${version}/index.js`;
}

export function buildPreviewInkImportMap(version: string): {
  imports: Record<string, string>;
} {
  return {
    imports: {
      [RUNTIME_PACKAGE]: buildPreviewInkModuleUrl(version),
    },
  };
}

async function getPublishedRuntimeVersions(
  config: RuntimeRegistryConfig,
): Promise<string[]> {
  const response = await fetch(config.registryUrl, {
    headers: { Accept: "application/json" },
  }).catch((error: unknown) => {
    throw createNetworkError(
      `failed to fetch runtime versions from ${config.sourceLabel}`,
      error,
    );
  });

  if (!response.ok) {
    throw new Error(
      `failed to fetch runtime versions from ${config.sourceLabel} (HTTP ${response.status})`,
    );
  }

  const body = await response.json() as { versions?: Record<string, unknown> };
  const versions = Object.keys(body.versions ?? {}).filter(isStableRuntimeVersion);
  if (versions.length === 0) {
    throw new Error("no stable runtime versions available");
  }

  return versions.sort(compareRuntimeVersionsDesc);
}

async function getRemoteCurrentRuntimeVersionFromRegistry(
  config: RuntimeRegistryConfig,
): Promise<string> {
  const response = await fetch(config.registryUrl, {
    headers: { Accept: "application/json" },
  }).catch((error: unknown) => {
    throw createNetworkError(
      `failed to fetch current runtime version from ${config.sourceLabel}`,
      error,
    );
  });

  if (!response.ok) {
    throw new Error(
      `failed to fetch current runtime version from ${config.sourceLabel} (HTTP ${response.status})`,
    );
  }

  const body = await response.json() as { "dist-tags"?: Record<string, unknown> };
  const latest = body["dist-tags"]?.latest;
  if (typeof latest !== "string" || latest.trim().length === 0) {
    throw new Error(
      `failed to resolve current runtime version from ${config.sourceLabel}`,
    );
  }

  return latest.trim();
}

function getRuntimeRegistryConfig(): RuntimeRegistryConfig {
  const provider = readRuntimeRegistryProviderFromEnv();
  switch (provider) {
    case "npm":
      return {
        provider,
        sourceLabel: "npm registry",
        registryUrl: `https://registry.npmjs.org/${RUNTIME_PACKAGE_ENCODED}`,
      };
    case "npmmirror":
      return {
        provider,
        sourceLabel: "npmmirror",
        registryUrl: `https://registry.npmmirror.com/${RUNTIME_PACKAGE_ENCODED}`,
      };
  }
}

function readRuntimeRegistryProviderFromEnv(): RuntimeRegistryProvider {
  const value = process.env[ENV_NPM_REGISTRY]?.trim();
  if (!value) {
    return "npm";
  }

  if (value === "npm" || value === "npmmirror") {
    return value;
  }

  throw new Error(
    `invalid ${ENV_NPM_REGISTRY} value: ${value} (expected one of: npm, npmmirror)`,
  );
}

function createNetworkError(message: string, cause: unknown): Error {
  if (!(cause instanceof Error)) {
    return new Error(message);
  }

  const reason = extractNetworkReason(cause);
  return reason ? new Error(`${message}: ${reason}`) : new Error(message);
}

function extractNetworkReason(error: Error): string | undefined {
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause instanceof Error && cause.message) {
    return cause.message;
  }
  return error.message || undefined;
}

function isStableRuntimeVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(version);
}

function compareRuntimeVersionsDesc(left: string, right: string): number {
  const leftParts = parseRuntimeVersion(left);
  const rightParts = parseRuntimeVersion(right);
  if (!leftParts || !rightParts) {
    return right.localeCompare(left);
  }

  if (leftParts.major !== rightParts.major) {
    return rightParts.major - leftParts.major;
  }
  if (leftParts.minor !== rightParts.minor) {
    return rightParts.minor - leftParts.minor;
  }
  if (leftParts.patch !== rightParts.patch) {
    return rightParts.patch - leftParts.patch;
  }

  const leftHasPrerelease = leftParts.prerelease !== undefined;
  const rightHasPrerelease = rightParts.prerelease !== undefined;
  if (leftHasPrerelease !== rightHasPrerelease) {
    return leftHasPrerelease ? 1 : -1;
  }
  if (!leftHasPrerelease && !rightHasPrerelease) {
    return 0;
  }

  if (leftParts.prerelease !== rightParts.prerelease) {
    return (rightParts.prerelease ?? "").localeCompare(leftParts.prerelease ?? "");
  }
  return (rightParts.prereleaseNumber ?? 0) - (leftParts.prereleaseNumber ?? 0);
}

function parseRuntimeVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  prereleaseNumber?: number;
} | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([A-Za-z0-9-]+)\.(\d+))?$/);
  if (!match) {
    return null;
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (![major, minor, patch].every(Number.isFinite)) {
    return null;
  }

  const prereleaseNumber = match[5] ? Number(match[5]) : undefined;
  if (match[5] && !Number.isFinite(prereleaseNumber)) {
    return null;
  }

  return {
    major,
    minor,
    patch,
    prerelease: match[4],
    prereleaseNumber,
  };
}
