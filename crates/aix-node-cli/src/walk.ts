import fs from 'node:fs';
import path from 'node:path';
import ignore, { Ignore } from 'ignore';

export type WalkedFile = { path: string; data: Uint8Array };

function loadIgnoreRules(rootDir: string): Ignore {
  const matcher = ignore();
  const aixignore = path.join(rootDir, '.aixignore');
  if (fs.existsSync(aixignore)) {
    const content = fs.readFileSync(aixignore, 'utf-8');
    matcher.add(content);
  }
  return matcher;
}

function isIgnored(matcher: Ignore, rootDir: string, absPath: string): boolean {
  const rel = path.relative(rootDir, absPath).split(path.sep).join('/');
  return matcher.ignores(rel);
}

export function walkDirectory(dir: string): WalkedFile[] {
  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) {
    throw new Error('Input path is not a directory');
  }
  const rootDir = path.resolve(dir);
  const matcher = loadIgnoreRules(rootDir);
  const results: WalkedFile[] = [];

  const visit = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      if (isIgnored(matcher, rootDir, abs)) {
        continue;
      }
      if (entry.isDirectory()) {
        visit(abs);
      } else if (entry.isFile() && entry.name !== '.aixignore') {
        const rel = path.relative(rootDir, abs).split(path.sep).join('/');
        results.push({ path: rel, data: new Uint8Array(fs.readFileSync(abs)) });
      }
    }
  };

  visit(rootDir);
  return results;
}