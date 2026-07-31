# AIX CLI

AIX CLI is a command-line utility for managing Ink AIX packages. It provides capabilities to pack directories into `.aix` files and inspect package contents.

## Installation

You can build and install it locally using Cargo:

```bash
cargo install --path crates/aix-cli
```

Once installed, the `aix` command will be available in your shell.

If you want to install the published crate from crates.io:

```bash
cargo install aiui-aix-cli
```

## Core Features

### 1. Pack

Packs a specified directory into an `.aix` file. During the packing process, a unique `VERSION` file (UUID v4) is automatically generated and placed at the root of the archive.

The packer also validates all `.json` files before writing them into the archive. If a JSON file is invalid, packing fails with an error. For `.json`, `.js`, and `.ink` files, non-UTF-8 input is converted to UTF-8 inside the packaged `.aix` output without modifying the source files on disk.

**Basic Usage:**

```bash
aix pack <INPUT_DIR>
```
*Defaults to `bundle.aix` if output path is not specified.*

**Specify Output Path:**

```bash
aix pack <INPUT_DIR> -o my-app.aix
```

**Enable Optimization:**

AIX CLI supports resource optimization to reduce package size. Currently, it supports PNG/JPEG compression and JSON minification.

```bash
# Enable default optimization (Level 2)
aix pack <INPUT_DIR> --optimize

# Specify optimization level (1-3)
aix pack <INPUT_DIR> -O --opt-level 3
```

**Ignore Files:**

The packer respects `.aixignore` files within the source directory, using the same syntax as `.gitignore`. Use it to exclude source code, documentation, or temporary files.

### 2. List

Lists all files and their size information within an `.aix` package.

```bash
aix list <AIX_FILE>
# or use the alias
aix ls <AIX_FILE>
```

### 3. Optimize

Optimizes JSON, PNG, and JPEG entries in an existing package using the same
cross-platform engine as the Web/WASM package.

```bash
aix optimize input.aix -o output.aix --level 2
```

## Development & Debugging

If you are at the project root, you can run the CLI directly using:

```bash
cargo run -p aiui-aix-cli -- pack fixtures/agents/capabilities -o test.aix
```

## License

MIT
