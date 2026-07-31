# AIX Pack

`aiui-aix-pack` is the in-memory AIX packaging and optimization engine shared by
native Rust applications and `wasm32-unknown-unknown` browser builds.

It builds `.aix` bytes from path/data entries, normalizes UTF-8 text, validates
and compacts JSON, optimizes PNG/JPEG resources with pure Rust codecs, and can
optimize an existing artifact. The crate does not access the file system.

```rust
use aix_pack::{pack, InputFile, OptimizeOptions, PackOptions};

let output = pack(
    vec![InputFile::new("app.json", br#"{ "pages": [] }"#)],
    PackOptions {
        build_id: "build-1".into(),
        optimize: Some(OptimizeOptions::default()),
    },
)?;

# Ok::<(), anyhow::Error>(())
```
