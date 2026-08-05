# AIX

AIX is an executable package format for AI agents.

It packages pages, schema, and tools into a distributable artifact that stays readable to Rust tooling, the command line, and the browser.

## What This Repository Contains

This repository is a Rust workspace with these package-facing surfaces:

- `crates/aix`: the `no_std + alloc` package reader, cryptography, signature verification, page analysis, and tool derivation layer
- `crates/aix-pack`: the in-memory Native/WASM packaging and optimization layer
- `crates/aix-cli`: the native Rust CLI (`aiui-aix-cli`), binary named `aix`
- `crates/aix-web`: the WASM and TypeScript surface for browser-based AIX inspection and integration
- `crates/aix-node-cli`: the npm-published CLI (`@yodaos-pkg/aix-cli`), a TypeScript shell over the same WASM engine
- `docs`: the official documentation site, including `Specification`, `Packages`, and `Play`

## Workspace Layout

```text
.
├── crates/
│   ├── aix/
│   ├── aix-pack/
│   ├── aix-cli/
│   ├── aix-web/
│   └── aix-node-cli/
├── docs/
├── Cargo.toml
└── README.md
```

## What AIX Carries

An `.aix` package is more than a zip archive. It is a structured artifact that can preserve:

- package entries and version metadata
- a content-derived package ID and engine compatibility range
- an optional Ed25519 signature and publisher public key
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
- generating Ed25519 key pairs and signing arbitrary data
- reading manifests, checking engine compatibility, and verifying signed packages
- parsing page definitions
- extracting page schema
- deriving tool definitions from package data

The core supports `no_std + alloc` when default features are disabled.

### `crates/aix-pack`

The pack crate builds and optimizes `.aix` bytes entirely in memory. It owns
text normalization, JSON compaction, and pure Rust PNG/JPEG optimization, and is
shared by the CLI and Web/WASM package. Every newly packed artifact contains a
manifest. Callers may optionally supply an Ed25519 private key to sign the final,
optimized package contents.

### `crates/aix-cli` and `crates/aix-node-cli`

Two CLI surfaces share the same packing engine and expose the identical `aix`
command. Pick whichever install path suits you:

- **Native (Rust):** `cargo install aiui-aix-cli` — compiled from `crates/aix-cli`.
- **npm:** `npm install -g @yodaos-pkg/aix-cli` — a TypeScript shell from
  `crates/aix-node-cli` over the Rust engine compiled to a Node.js WASM bundle.

It currently focuses on:

- `aix pack <INPUT_DIR>` for building `.aix` artifacts, with an optional engine version range
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
- `supportsEngine(version)` for checking runtime compatibility

The official browser surface for this package is `docs/play.md`, published as `/play`.

## Typical Package Shape

```text
.
├── AGENTS.md
├── VERSION
├── app.json
├── app.js
├── pages/
└── META-INF/
    └── aix/
        ├── manifest.json
        ├── public-key.ed25519       # signed packages only
        └── signature.ed25519        # signed packages only
```

Typical files include:

- `AGENTS.md` for agent identity and capability context
- `VERSION` for the legacy build ID used by extraction caches
- `app.json` for app-level metadata and routing
- `app.js` for runtime entry logic
- `pages/` for page definitions, assets, and schema-bearing files
- `META-INF/aix/manifest.json` for the build ID, content-derived package ID,
  engine range, file sizes, and SHA-256 digests

`manifest.version` mirrors `VERSION` for compatibility. New runtimes should use
`manifest.package_id` as the content identity while retaining the `VERSION`
fallback for older packages.

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
    println!("supports engine 0.14.2 = {}", reader.supports_engine("0.14.2")?);

    Ok(())
}
```

### Package Or Inspect With The CLI

Install the `aix` command either way — both surfaces are behavior-identical:

```bash
# npm (no Rust toolchain needed)
npm install -g @yodaos-pkg/aix-cli

# or native Rust
cargo install aiui-aix-cli
```

Then:

```bash
aix pack ./my-agent -o bundle.aix --engine '^0.14.0'
aix list ./bundle.aix
```

The engine range defaults to `*`. A complete version such as `0.14.0` is an
exact match; ranges such as `>=0.14.0` and `^0.14.0` are also accepted.

### Sign And Verify In Rust

Key generation accepts a caller-provided cryptographically secure random number
generator, keeping the core API portable across native, WASM, and embedded
targets. Package signing happens after normalization and optimization.

```rust
use aix::crypto::{PrivateKey, PublicKey};
use aix_pack::{pack, InputFile, PackOptions};
use rand_core::OsRng;

fn main() -> anyhow::Result<()> {
    let private_key = PrivateKey::generate(&mut OsRng);
    let mut options = PackOptions::new("build-1");
    options.engine = "^0.14.0".into();
    options.signing_key = Some(&private_key);

    let output = pack(
        vec![InputFile::new("app.json", br#"{"pages":[]}"#)],
        options,
    )?;

    // Production runtimes should load this from a trusted store instead of
    // trusting the public key embedded in the package.
    let trusted_key: PublicKey = private_key.public_key();
    let reader = aix::AixReader::new(output.data)?;
    let report = reader.verify_signature(&trusted_key)?;

    assert!(reader.supports_engine("0.14.2")?);
    println!("verified package {}", report.package_id);
    Ok(())
}
```

Native callers using `OsRng` should enable the `getrandom` feature on their
`rand_core` dependency. Bare-metal `no_std` callers provide their platform RNG.

### Read AIX In The Browser

```ts
import { AIX } from "@yodaos-pkg/aix";

async function inspect(file: File) {
  const aix = await AIX.From(file);
  console.log(aix.getTitle());
  console.log(aix.getPages());
  console.log(aix.getTools());
  console.log(aix.supportsEngine("0.14.2"));
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
cargo test -p aiui-aix -p aiui-aix-cli
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
