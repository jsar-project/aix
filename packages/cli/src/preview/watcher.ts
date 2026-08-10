import fs from "node:fs";
import path from "node:path";

export function startSourceWatcher(
  inputPath: string,
  onChange: () => void,
): () => void {
  const resolvedPath = path.resolve(inputPath);
  const stat = fs.statSync(resolvedPath);
  let watchers: fs.FSWatcher[] = [];
  let rebuildTimer: NodeJS.Timeout | undefined;
  let refreshTimer: NodeJS.Timeout | undefined;
  let closed = false;

  const scheduleRebuild = () => {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
      if (!closed) {
        onChange();
      }
    }, 120);
  };

  const closeWatchers = () => {
    for (const watcher of watchers) {
      watcher.close();
    }
    watchers = [];
  };

  const refreshDirectoryWatchers = () => {
    if (closed || !stat.isDirectory()) {
      return;
    }
    closeWatchers();
    for (const dir of listDirectories(resolvedPath)) {
      watchers.push(
        fs.watch(dir, () => {
          scheduleRebuild();
          clearTimeout(refreshTimer);
          refreshTimer = setTimeout(() => {
            if (!closed) {
              refreshDirectoryWatchers();
            }
          }, 160);
        }),
      );
    }
  };

  if (stat.isDirectory()) {
    try {
      watchers.push(
        fs.watch(resolvedPath, { recursive: true }, () => {
          scheduleRebuild();
        }),
      );
    } catch {
      refreshDirectoryWatchers();
    }
  } else {
    watchers.push(
      fs.watch(resolvedPath, () => {
        scheduleRebuild();
      }),
    );
  }

  return () => {
    closed = true;
    clearTimeout(rebuildTimer);
    clearTimeout(refreshTimer);
    closeWatchers();
  };
}

function listDirectories(rootDir: string): string[] {
  const directories = [rootDir];
  const visit = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const nextDir = path.join(current, entry.name);
      directories.push(nextDir);
      visit(nextDir);
    }
  };
  visit(rootDir);
  return directories;
}
