# @yodaos-pkg/aix-cli

Command-line tool for packing, validating, and inspecting **AIX** (AI eXecutable)
packages — the executable package format for AI agents.

Install with npm:

```bash
npm install -g @yodaos-pkg/aix-cli
```

Once installed, the `aix` command is available in your shell.

## Commands

### `aix pack <INPUT_DIR>`

Packs a directory into an `.aix` file. A unique `VERSION` entry (UUID v4) is
generated automatically. JSON files are validated before packing; non-UTF-8
`.json`/`.js`/`.ink` files are converted to UTF-8 inside the artifact.

```bash
aix pack ./my-agent                  # defaults to bundle.aix
aix pack ./my-agent -o my-app.aix
aix pack ./my-agent --optimize       # PNG/JPEG + JSON minification
aix pack ./my-agent -O --opt-level 3 # optimization level 1-3
aix pack ./my-agent --engine '^0.14.0'
```

`.aixignore` files inside the input directory are honored (`.gitignore` syntax).

### `aix list <AIX_FILE>`

Lists all files and sizes inside an `.aix` package. Alias: `aix ls`.

```bash
aix list bundle.aix
```

### `aix optimize <AIX_FILE> -o <OUTPUT>`

Optimizes JSON, PNG, and JPEG entries in an existing package.

```bash
aix optimize input.aix -o output.aix --level 2
```

## Development

```bash
npm install
npm run build   # compiles the Rust engine to WASM (requires rustup + wasm32-unknown-unknown + wasm-pack), then bundles the CLI
```

## How it works

The CLI is a thin TypeScript shell over the Rust AIX engine compiled to a
Node.js WASM bundle (`wasm-pack --target nodejs`). Packing, optimization, and
reading logic is shared byte-for-byte with the Rust/Web surfaces — no behavior
fork.

## License

MIT
