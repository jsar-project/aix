# CLI

The AIX CLI packages application directories, inspects archive contents, and
optimizes existing `.aix` artifacts. It uses the same Rust packing engine as the
Web/WASM package.

## Install

Install the published crate:

```bash
cargo install aiui-aix-cli
```

To build the current workspace version instead:

```bash
cargo install --path crates/aix-cli
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

## Run From The Workspace

During development, run the CLI without installing it:

```bash
cargo run -p aiui-aix-cli -- pack ./my-agent -o bundle.aix
```

Pass `--help` after a subcommand to inspect its current options:

```bash
cargo run -p aiui-aix-cli -- pack --help
```

## Related Documentation

- Read the [Specification](/spec) for the package model.
- Review [Packages](/packages) for the Rust and Web/WASM surfaces.
- Open the [Package Lab](/play) to inspect an artifact in the browser.
