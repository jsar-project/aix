# Contributing to AIX

Thanks for contributing to AIX.

AIX is an executable package format for AI agents. This repository is a Rust workspace with four package-facing surfaces:

- `crates/aix`: core Rust library
- `crates/aix-pack`: in-memory Native/WASM packer and optimizer
- `crates/aix-cli`: command-line interface
- `crates/aix-web`: WASM and TypeScript package
- `docs`: the VitePress documentation site

## Before You Start

Make sure your local environment includes:

- Rust stable
- the `wasm32-unknown-unknown` target
- `wasm-pack`
- Node.js 18+ and npm

Recommended setup:

```bash
rustup toolchain install stable
rustup default stable
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
node --version
npm --version
```

## Repository Layout

```text
.
├── crates/
│   ├── aix/
│   ├── aix-pack/
│   ├── aix-cli/
│   └── aix-web/
├── docs/
├── .github/workflows/
├── Cargo.toml
└── CONTRIBUTING.md
```

The workspace is intentionally split by surface area:

- `aix` owns the package model and analysis logic
- `aix-pack` owns in-memory packaging, normalization, and resource optimization
- `aix-cli` turns the format into terminal workflows
- `aix-web` exposes the same capabilities through WASM and TypeScript
- `docs` is the official site for `Specification`, `Packages`, and `Play`

## Build From Source

### Build and validate the Rust workspace

From the repository root:

```bash
cargo test -p aiui-aix -p aiui-aix-pack -p aiui-aix-cli
cargo check -p aiui-aix-web --target wasm32-unknown-unknown
```

This matches the baseline validation performed in CI.

### Build the web package

The npm package in `crates/aix-web` depends on the Rust/WASM build output.

```bash
cd crates/aix-web
npm install
npm run build
```

What this does:

- builds the WASM artifact with `wasm-pack`
- compiles the TypeScript entrypoint
- generates publish-ready files under `crates/aix-web/dist`

Important: publishable npm metadata is generated into `dist/package.json`. Do not publish from the package root unless you intentionally know what you are changing.

### Run the docs site locally

The docs site consumes the local web package during development.

```bash
cd docs
npm install
npm run dev
```

## Development Workflow

Typical workflow:

1. Create a branch for your change.
2. Implement the change in the smallest relevant surface.
3. Run the validation commands relevant to that surface.
4. Update docs when behavior, commands, or package interfaces change.
5. Open a pull request with a clear summary and verification notes.

When changing multiple surfaces, prefer validating them in this order:

1. `crates/aix`
2. `crates/aix-cli`
3. `crates/aix-web`
4. `docs`

This keeps the core model stable before checking derived interfaces.

## Code Style

### General

- Keep changes focused and modular.
- Prefer small, explicit functions over large mixed-responsibility blocks.
- Preserve existing naming and file organization patterns.
- Add comments only when intent would otherwise be hard to infer.

### Rust

- Run `cargo fmt --all` before opening a pull request.
- Prefer returning structured errors instead of panicking in normal flows.
- Keep public APIs small and readable.
- When adding parsing or package logic, include targeted tests when practical.

### TypeScript and web

- Keep the TypeScript surface aligned with the Rust/WASM API.
- Avoid introducing bundler-specific behavior unless it is necessary for `docs` or package distribution.
- Make build outputs reproducible from source; do not hand-edit generated `dist/` artifacts.

### Documentation and terminology

- Use `AI agents`, not `AI applications`.
- Use `Play`, not `Package Lab`.
- Use `Specification`, not `Format`, when referring to the docs information architecture.
- Keep top-level repository docs in English.
- When changing contributor or user-facing behavior, update the relevant docs in the same pull request when possible.

## Testing and Validation

Run the smallest useful set of checks for your change, and expand only when the change crosses package boundaries.

Common commands:

```bash
# Rust validation
cargo test -p aiui-aix -p aiui-aix-cli
cargo check -p aiui-aix-web --target wasm32-unknown-unknown

# Web package build
cd crates/aix-web && npm install && npm run build

# Docs site build
cd docs && npm install && npm run build
```

If your change affects packaging, CLI output, WASM bindings, or docs integration, mention the exact commands you ran in the pull request description.

## Release Process

This repository currently has two release tracks:

1. crates published to crates.io
2. the web package published to npm

### Release checklist

Before any release:

1. Make sure the intended version is correct in crate manifests.
2. Run baseline validation from the repository root.
3. Confirm README and docs still match the shipped behavior.
4. Make sure the release commit is merged and tagged according to your release policy.

### Publish crates to crates.io

The repository already includes a manual GitHub Actions workflow at `.github/workflows/publish-crates.yml`.

It supports:

- `aiui-aix`
- `aiui-aix-cli`
- `all`
- optional dry run mode

Recommended order:

1. Run the workflow with `dry_run: true`.
2. Publish `aiui-aix` first.
3. Publish `aiui-aix-cli` after `aiui-aix` is available on crates.io.

Why this order matters:

- `aiui-aix-cli` depends on `aiui-aix`
- when publishing `all`, the workflow waits briefly for crates.io index propagation before publishing `aiui-aix-cli`

The workflow expects `CARGO_REGISTRY_TOKEN` to be configured in GitHub Actions secrets for non-dry-run releases.

If you need to validate locally before using the workflow:

```bash
cargo publish -p aiui-aix --dry-run
cargo package -p aiui-aix-cli --list
```

### Publish the npm package

The npm package lives under `crates/aix-web`, but the publish-ready package is generated into `crates/aix-web/dist`.

Recommended process:

```bash
cd crates/aix-web
npm install
npm run build
cd dist
npm pack --dry-run
npm publish --access public
```

Notes:

- The published version is generated from `crates/aix-web/Cargo.toml`, not copied from the source `package.json` version field.
- `npm run build` creates `dist/package.json`, copies the README, and prepares `dist/pkg` for publishing.
- Publish from `dist/`, not from `crates/aix-web/`.
- Make sure you are logged in to the correct npm account before publishing.

If a release includes both crates and npm:

1. publish `aiui-aix`
2. publish `aiui-aix-cli`
3. build and publish `@yodaos-pkg/aix`
4. verify the docs site still resolves the released package as expected

## Pull Request Guidelines

- Keep each pull request scoped to one logical change.
- Include context, what changed, and how you verified it.
- Link related issues when relevant.
- Call out breaking changes explicitly.
- Include screenshots only when the docs UI or `Play` experience changes.

Good pull requests are easy to review because they explain:

- what changed
- why it changed
- how it was validated

## Reporting Issues

When filing an issue, include as much of the following as possible:

- the package or surface involved (`aix`, `aix-cli`, `aix-web`, or `docs`)
- reproduction steps
- expected behavior
- actual behavior
- sample `.aix` artifact or minimal fixture when relevant
- platform details if the issue appears environment-specific

## Questions

If you are unsure where a change belongs, start with the smallest surface that can own it cleanly. If the change affects package semantics, begin in `crates/aix` and let the CLI, web, and docs layers follow from there.
