# AIX

AIX is an executable package format for AI agents.

It packages pages, schema, and tools into a distributable artifact that stays readable to Rust tooling, the command line, and the browser.

## What This Repository Contains

This repository is a Rust workspace with four package-facing surfaces:

- `crates/aix`: the `no_std + alloc` package reader, page analysis, and tool derivation layer
- `crates/aix-pack`: the in-memory Native/WASM packaging and optimization layer
- `crates/aix-cli`: the command-line surface for packaging, validating, and inspecting `.aix` artifacts
- `crates/aix-web`: the WASM and TypeScript surface for browser-based AIX inspection and integration
- `docs`: the official documentation site, including `Specification`, `Packages`, and `Play`

## Workspace Layout

```text
.
├── crates/
│   ├── aix/
│   ├── aix-pack/
│   ├── aix-cli/
│   └── aix-web/
├── docs/
├── Cargo.toml
└── README.md
```

## What AIX Carries

An `.aix` package is more than a zip archive. It is a structured artifact that can preserve:

- package entries and version metadata
- app and page definitions
- schema-defined inputs
- layout and target hints
- derived tool surfaces for AI agents

In practice, the same package can be read by Rust, CLI, and Web/WASM tooling without losing the package-native structure.

## Packages

### `crates/aix`

The core crate defines the AIX reading model. It is responsible for:

- listing package entries
- reading files from the archive
- resolving version and title metadata
- parsing page definitions
- extracting page schema
- deriving tool definitions from package data

The core supports `no_std + alloc` when default features are disabled.

### `crates/aix-pack`

The pack crate builds and optimizes `.aix` bytes entirely in memory. It owns
text normalization, JSON compaction, and pure Rust PNG/JPEG optimization, and is
shared by the CLI and Web/WASM package.

### `crates/aix-cli`

The CLI turns the format into terminal workflows. It currently focuses on:

- `aix pack <INPUT_DIR>` for building `.aix` artifacts
- `aix list <AIX_FILE>` or `aix ls <AIX_FILE>` for inspecting package contents
- `aix optimize <AIX_FILE> -o <OUTPUT_FILE>` for optimizing an existing artifact
- validation and normalization during packaging
- `.aixignore` support and optional optimization paths

### `crates/aix-web`

The web package exposes the same AIX model through WASM and TypeScript APIs.

Typical capabilities include:

- `AIX.From(data)` from `Uint8Array` or `File`
- `list()` for package entries
- `readFile(name)` for raw file access
- `getVersion()`, `getTitle()`, `getPages()`, and `getTools()`

The official browser surface for this package is `docs/play.md`, published as `/play`.

## Typical Package Shape

```text
.
├── AGENTS.md
├── VERSION
├── app.json
├── app.js
└── pages/
```

Typical files include:

- `AGENTS.md` for agent identity and capability context
- `VERSION` for package versioning
- `app.json` for app-level metadata and routing
- `app.js` for runtime entry logic
- `pages/` for page definitions, assets, and schema-bearing files

## Quick Start

### Read AIX in Rust

```rust
use aix::AixReader;

fn main() -> anyhow::Result<()> {
    let data = std::fs::read("bundle.aix")?;
    let reader = AixReader::new(data)?;

    println!("version = {:?}", reader.get_version());
    println!("title = {:?}", reader.get_title());
    println!("pages = {:?}", reader.get_pages());
    println!("tools = {:?}", reader.get_tools());

    Ok(())
}
```

### Package Or Inspect With The CLI

```bash
cargo run -p aiui-aix-cli -- pack ./my-agent -o bundle.aix
```

```bash
cargo run -p aiui-aix-cli -- list ./bundle.aix
```

### Read AIX In The Browser

```ts
import { AIX } from "@yodaos-pkg/aix";

async function inspect(file: File) {
  const aix = await AIX.From(file);
  console.log(aix.getTitle());
  console.log(aix.getPages());
  console.log(aix.getTools());
}
```

## Docs Site

The documentation site lives in `docs/` and is organized around three primary routes:

- `/spec`: the AIX specification overview
- `/packages`: the workspace package surfaces
- `/play`: upload and inspect real `.aix` artifacts in the browser

Run it locally:

```bash
cd docs
npm install
npm run dev
```

## Development

Validate the workspace from the repository root:

```bash
cargo test -p aiui-aix -p aiui-aix-pack -p aiui-aix-cli
cargo check -p aiui-aix-web --target wasm32-unknown-unknown
```

Build the web package outputs:

```bash
cd crates/aix-web
npm install
npm run build
```

## License

MIT
