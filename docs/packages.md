# Packages

The AIX repository is organized as a Rust workspace with these format-facing surfaces.

## `crates/aix`

This crate is the core reading and analysis layer.

It is responsible for the package-facing concepts that define the AIX model:

- reading package entries
- surfacing metadata like version and title
- resolving page information
- deriving tool definitions from page schema

If you want to understand the format itself, start here.

The crate supports `no_std + alloc` for embedded and RTOS consumers when default
features are disabled.

## `crates/aix-pack`

The pack crate is the shared in-memory authoring layer for Native and Web/WASM.
It builds AIX artifacts, normalizes text, compacts JSON, and optimizes PNG/JPEG
resources using pure Rust codecs.

## `crates/aix-cli`

The native Rust CLI (`aiui-aix-cli`) is the packaging and inspection surface,
installed with `cargo install aiui-aix-cli`. The binary is named `aix`.

It turns the format into developer workflows such as:

- packaging directories into `.aix`
- validating and normalizing packaged assets
- listing package contents

## `crates/aix-node-cli`

The npm-published CLI (`@yodaos-pkg/aix-cli`) is the packaging and inspection
surface, installed with `npm install -g @yodaos-pkg/aix-cli`. It is a thin
TypeScript shell over the same WASM engine, so its behavior matches the native
Rust CLI — the two surfaces are interchangeable.

It turns the format into developer workflows such as:

- packaging directories into `.aix`
- validating and normalizing packaged assets
- listing package contents

## `crates/aix-web`

This package exposes AIX in browser-facing environments through WASM.

It makes the format readable inside interactive interfaces, including the official package lab published with this site.

## Development Flow

Typical validation flow:

```bash
cargo test -p aiui-aix -p aiui-aix-cli
cargo check -p aiui-aix-web --target wasm32-unknown-unknown
```

## Relationship To The Website

The docs site explains the model.

The packages implement the model.

The Package Lab demonstrates the model against real `.aix` artifacts.

## Explore Further

- Read the [Specification](/spec)
- Open the [Package Lab](/play)
