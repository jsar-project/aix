const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const aixWebDir = path.resolve(rootDir, '../aix-web');
const wasmOutDir = path.join(aixWebDir, 'dist', 'pkg-cli');
const pkgDir = path.join(distDir, 'pkg');

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

execSync(
  `wasm-pack build --target nodejs --out-dir ${JSON.stringify(wasmOutDir)} --out-name aix_web --no-opt`,
  { cwd: aixWebDir, stdio: 'inherit' },
);

// The wasm-bindgen wrapper resolves `aix_web_bg.wasm` relative to its own
// __dirname, so the .wasm file must sit next to the wrapper after bundling.
fs.mkdirSync(pkgDir, { recursive: true });
for (const file of ['aix_web.js', 'aix_web_bg.wasm']) {
  const src = path.join(wasmOutDir, file);
  if (!fs.existsSync(src)) {
    throw new Error(`Missing WASM artifact: ${src}`);
  }
  fs.copyFileSync(src, path.join(pkgDir, file));
}

// The WASM wrapper is intentionally NOT bundled: cli.ts loads it through a
// dynamic require so its __dirname stays correct. `ignore` is external for
// the same reason (it must resolve from node_modules at runtime).
execSync(
  'npx esbuild src/cli.ts --bundle --platform=node --format=cjs --target=node20 --outfile=dist/cli.js --banner:js="#!/usr/bin/env node" --external:ignore',
  { cwd: rootDir, stdio: 'inherit' },
);

fs.chmodSync(path.join(distDir, 'cli.js'), 0o755);

execSync('npx tsc --noEmit', { cwd: rootDir, stdio: 'inherit' });

console.log('Build completed. Output in dist/');
