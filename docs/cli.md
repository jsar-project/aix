# CLI

The AIX CLI packages application directories, inspects archive contents, and
optimizes existing `.aix` artifacts. Two surfaces expose the identical `aix`
command, sharing the same Rust packing engine:

- **npm** (`@yodaos-pkg/aix-cli`) — a TypeScript shell over the Rust engine
  compiled to a Node.js WASM bundle.
- **Native (Rust)** (`aiui-aix-cli`) — a compiled binary from the same engine.

## Install

Pick either install path:

```bash
# npm (no Rust toolchain needed)
npm install -g @yodaos-pkg/aix-cli

# or native Rust
cargo install aiui-aix-cli
```

After installation, confirm that the command is available:

```bash
aix --help
```

## Pack A Directory

Create an AIX package from a source directory:

```bash
aix pack ./my-agent
```

The default output is `bundle.aix`. Use `--output` or `-o` to choose another
path:

```bash
aix pack ./my-agent -o dist/my-agent.aix
```

Packing performs the following work before writing the archive:

- respects `.aixignore` and the standard ignore files
- validates JSON files
- converts supported text files to UTF-8 when needed
- generates a unique `VERSION` build ID
- generates `META-INF/aix/manifest.json` with file digests and package metadata

### Engine Compatibility

Use `--engine` to declare which AIX engine versions may run the package:

```bash
aix pack ./my-agent --engine '^0.14.0'
```

The range defaults to `*`. Common forms include:

```text
*           any engine version
0.14.0      exactly 0.14.0
>=0.14.0    0.14.0 or newer
^0.14.0     versions compatible with 0.14.0
```

The range is validated during packing and saved as `manifest.engine`.

### Optimize While Packing

Enable JSON, PNG, and JPEG optimization with `--optimize` or `-O`:

```bash
aix pack ./my-agent -O
```

Optimization levels range from 1 to 3 and default to 2:

```bash
aix pack ./my-agent -O --opt-level 3
```

Optimization changes only the packaged output. Source files remain untouched.

### Pack Options

```text
Usage: aix pack [OPTIONS] <INPUT_DIR>

Arguments:
  <INPUT_DIR>  Input directory to pack

Options:
  -o, --output <OUTPUT_FILE>   Output file [default: bundle.aix]
  -O, --optimize               Enable optimization
      --opt-level <LEVEL>      Optimization level, 1-3 [default: 2]
      --engine <RANGE>         Supported engine range [default: *]
  -h, --help                   Print help
```

## List Package Contents

Inspect entry names and their uncompressed and compressed sizes:

```bash
aix list ./bundle.aix
```

`ls` is available as a shorter alias:

```bash
aix ls ./bundle.aix
```

## Optimize An Existing Package

Write an optimized copy of an existing artifact:

```bash
aix optimize ./bundle.aix -o ./bundle.optimized.aix
```

Choose an optimization level when needed:

```bash
aix optimize ./bundle.aix -o ./bundle.optimized.aix --level 3
```

The optimizer preserves the existing engine range. Because optimization changes
package contents, it removes any previous signature and writes a new unsigned
manifest. Sign the optimized artifact again before distribution when signature
verification is required.

## Preview In The Browser

Preview either an existing `.aix` package or an AIX source directory in a local
browser host powered by `@yodaos-pkg/ink`:

```bash
aix preview ./bundle.aix
aix preview ./my-agent
```

By default, the command starts a local HTTP server, serves the preview page from
memory, and prints the preview URL without opening the browser automatically.
The default preview mode embeds a snapshot of the current bundle contents into a
single HTML document while loading the Ink SDK from the network at runtime. The
preview viewport is fixed at `448x352`.

If you want the CLI to launch your default browser automatically, add
`--launch`:

```bash
aix preview ./bundle.aix --launch
```

### Export A Static Preview

Use `--html-out` when you want to write the generated HTML to disk instead of
starting a local server:

```bash
aix preview ./bundle.aix --html-out ./artifacts/preview.html
```

When `--html-out` is provided:

- the CLI writes the generated HTML to the requested file
- relative output paths resolve from the current working directory
- parent directories are created automatically when needed
- no local preview server is started
- the browser is not opened automatically
- `--launch` is not allowed

### Development Mode

Use `--dev` when you want the preview page to load state from the preview server
instead of embedding a fixed snapshot:

```bash
aix preview ./bundle.aix --dev
aix preview ./my-agent --dev
aix preview ./my-agent --dev --launch
```

In `--dev` mode:

- the local preview server always starts
- the page fetches preview state from the server
- the page connects to a WebSocket endpoint for change notifications
- `.aix` file changes and directory file changes both trigger live reload
- the page rebuilds the `InkView` without refreshing the full document
- `--html-out` is not allowed
- add `--launch` if you want the browser to open automatically

## Run From The Workspace

During development, run either surface without installing it globally:

```bash
# npm surface
cd packages/cli
npm install
npm run build
node dist/cli.js pack ./my-agent -o bundle.aix

# native Rust surface
cargo run -p aiui-aix-cli -- pack ./my-agent -o bundle.aix
```

Pass `--help` after a subcommand to inspect its current options:

```bash
node dist/cli.js pack --help
```

## Related Documentation

- Read the [Specification](/spec) for the package model.
- Review [Packages](/packages) for the Rust and Web/WASM surfaces.
- Open the [Package Lab](/play) to inspect an artifact in the browser.
