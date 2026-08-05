# AGENTS.md

Rust workspace for **AIX**, an executable package format for AI agents. `.aix` artifacts are zip archives carrying app metadata, page schema, and derived AI tool surfaces.

## Warehouse layout and naming (read carefully)

The directory name, Cargo package name, and npm package name all differ. Use the **Cargo package name** (`-p`) in every command.

| Directory | Cargo package (`-p`) | Role |
|---|---|---|
| `crates/aix` | `aiui-aix` | Core reader: zip parsing, crypto, page analysis, tool derivation. Supports `no_std + alloc`. |
| `crates/aix-pack` | `aiui-aix-pack` | In-memory packer/optimizer (no filesystem). Shared by native CLI, WASM + npm CLI. |
| `crates/aix-web` | `aiui-aix-web` | WASM + TypeScript surface. npm package `@yodaos-pkg/aix`. |
| `crates/aix-cli` | `aiui-aix-cli` | Native Rust CLI, binary named `aix`. Install via `cargo install aiui-aix-cli`. |
| `crates/aix-node-cli` | — | npm CLI `@yodaos-pkg/aix-cli`. TS shell over the same WASM engine. Install via `npm install -g @yodaos-pkg/aix-cli`. |
| `docs/` | — | VitePress site (`/spec`, `/cli`, `/packages`, `/play`). |

All four crates are versioned `0.7.0`. Dependencies embed both `path` and `version`, so bump versions across `crates/*/Cargo.toml` together.

## CLI surfaces (two install paths, one `aix` command)

The `aix` command can be installed two ways; pick one. Both share the same packing engine and behave identically:

- Native Rust binary: `cargo install aiui-aix-cli` (compiled from `crates/aix-cli`).
- npm package: `npm install -g @yodaos-pkg/aix-cli` (compiled from `crates/aix-node-cli`, a TypeScript shell over the Rust engine built to a Node.js WASM bundle).

## npm CLI (`crates/aix-node-cli`)

```bash
cd crates/aix-node-cli && npm install && npm run build
```

- `npm run build` runs `wasm-pack build --target nodejs` (from `crates/aix-web`) then bundles `src/cli.ts` with esbuild into `dist/cli.js`, copying the WASM artifact to `dist/pkg/`.
- The WASM wrapper (`dist/pkg/aix_web.js`) resolves `aix_web_bg.wasm` relative to its own `__dirname`, so the two files must stay adjacent — do **not** bundle the wrapper into cli.js (the `require(path.join(__dirname, 'pkg', ...))` in `src/wasm.ts` is intentional).
- `ignore` is the only runtime dependency (`.aixignore` support); it is external in the esbuild bundle.
- The engine is compiled with `--no-opt` to skip binaryen/wasm-opt downloads.

## Development commands

```bash
# Baseline validation (matches CI)
cargo test -p aiui-aix -p aiui-aix-cli
cargo check -p aiui-aix-web --target wasm32-unknown-unknown
cargo clippy --workspace --all-targets -- -D warnings   # CI enforces -D warnings

# no_std check for the core crate (must stay no_std-compatible)
cargo check -p aiui-aix --no-default-features
```

- CI runs `cargo test -p aiui-aix -p aiui-aix-cli` on native, plus a wasm check and an npm CLI build job. `aiui-aix-pack` has its own unit tests but CI does **not** run them — run `cargo test -p aiui-aix-pack` yourself when you touch it.
- WASM checks require `cargo` with the `wasm32-unknown-unknown` target installed: `rustup target add wasm32-unknown-unknown`.
- Evaluating a full WASM build requires `wasm-pack`: `cd crates/aix-web && npm install && npm run build` (outputs to `crates/aix-web/dist`).
- Building the npm CLI requires the same toolchain (rustup + wasm32 target + wasm-pack): `cd crates/aix-node-cli && npm install && npm run build`. `wasm-pack` runs with `--no-opt`, so it skips downloading binaryen — this matters in sandboxed/offline CI.

## Docs site (VitePress)

```bash
cd docs && npm install && npm run dev
```

- `docs` scripts **auto-build the aix-web WASM package first** (`npm run build:aix-web`) before starting VitePress. Do not skip that build; `/play` loads the local WASM bundle.
- Configure GitHub Pages base via env `BASE_PATH` (defaults to `/aix`); CI sets `BASE_PATH=/aix`.
- The docs site consumes the web package through a `file:` dependency on `crates/aix-web`.

## Web package build / publish gotchas

- `crates/aix-web/scripts/build.js` reads the **version from `Cargo.toml`, not `package.json`**. Clean `dist/`, runs `wasm-pack`, patches import paths, and writes `dist/package.json` + `dist/jsr.json`, then copies the README.
- **Publish from `crates/aix-web/dist/`, never from the package root.** Do not hand-edit generated `dist/` outputs — rebuild.
- `docs` and web builds produce gitignored artifacts (`/crates/aix-web/dist`, `/crates/aix-web/pkg`, `/crates/aix-web/node_modules`).

## Core crate constraints (`crates/aix`)

- File `src/lib.rs` is `#![no_std]` unless feature `std` is enabled (default). New code must compile with `no-default-features`. Use `alloc` types and the inline `hashbrown`/`std` imports pattern already present — never add `std::` imports at the top level.
- Features: `std` (default) and `wasm` (adds wasm-bindgen console warnings). `aiui-aix-web` enables `aix` with `wasm`.
- Reader (`AixReader`) pulls zip with `rawzip` + `miniz_oxide`, then **re-verifies CRC + size** per entry. Error strings are asserted in tests — don't loosen them casually.

### Signature / manifest invariants (do not weaken)

`crates/aix/src/crypto/mod.rs` and `verify_signature` in `lib.rs` enforce:
- `manifest.entries` must be **strictly increasing by byte order** and must exclude `META-INF/aix/*` paths; every non-directory, non-metadata zip entry must be present in the manifest.
- `manifest.version` must equal the `VERSION` entry; `key_id` must match the trusted key.
- `calculate_package_id` hashes (len + path + size + len + sha256) with a specific byte layout — changing it invalidates existing signed packages.
- Signing context/domain prefix is `AIX-SIGNATURE\0`.

## Page / tool derivation

- Layout analysis (`PageAnalyzer` in `analyzer.rs`) infers width/height from inline styles + `.wxml`/`.wcss` and defaults to `480×168` (`PageConstraint::default()`). Height **stacks**, width takes the **max** across root nodes.
- `.ink` single-file components are parsed by `xml::parse_sfc` (raw-text blocks); multi-file pages use `xml::parse_xml`.
- `get_tools()` returns OpenAI-style tools; the **first page with an empty/no-parameter schema** becomes `ToolTarget::Blank`, others `ToolTarget::Current`.

## CLI behavior

- `aix pack <INPUT_DIR>` auto-generates a UUID v4 as the build id / `VERSION`; rejects input named `VERSION`. Native (`crates/aix-cli`) and npm (`crates/aix-node-cli`) surfaces are behavior-identical.
- Packing validates all `.json`; converts non-UTF-8 `.json`/`.js`/`.ink` (UTF-16/GB18030/detected) to UTF-8; binary PNG/JPEG may be compressed per `--opt-level` (1-3).
- `.aixignore` uses `.gitignore` syntax and is honored when packing (rule file itself is excluded). There is no `.aixignore` in this repo — README examples referencing a `fixtures/` directory are **stale** (no `fixtures/` exists).

## Crate publishing order

`aiui-aix-cli` depends on `aiui-aix`. Publish `aiui-aix` first, then `aiui-aix-cli` (wait for crates.io index). Use the manual workflow `.github/workflows/publish-crates.yml` with `dry_run: true` first. The npm CLI has its own manual workflow `.github/workflows/publish-npm-cli.yml` (requires `NPM_TOKEN` secret).

## Conventions

- Keep top-level repository docs in English. Terminology: **AI agents** (not "AI applications"), **Play** (not "Package Lab"), **Specification** (not "Format").
- Native tests are inline `#[cfg(test)]` modules that construct zip fixtures in memory via `zip::ZipWriter` — there is no external test-fixture directory.
- Rust: run `cargo fmt --all` before opening a PR; prefer structured errors over panics.