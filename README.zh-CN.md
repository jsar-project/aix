# AIX

AIX 是一种面向 AI agents 的可执行包格式。

它把页面、schema 和 tools 打包成一个可分发的 artifact，同时保持对 Rust 工具、命令行和浏览器环境可读。

## 仓库包含什么

这个仓库是一个 Rust workspace，包含四层面向格式本身的实现：

- `crates/aix`：支持 `no_std + alloc` 的包读取、页面分析和 tool 推导核心
- `crates/aix-pack`：面向 Native 和 Web/WASM 的纯内存打包与资源优化能力
- `crates/aix-cli`：用于打包、校验和检查 `.aix` artifact 的命令行入口
- `crates/aix-web`：面向浏览器的 WASM 和 TypeScript 接口
- `docs`：官方文档站，包含 `Specification`、`Packages` 和 `Play`

## Workspace 结构

```text
.
├── crates/
│   ├── aix/
│   ├── aix-pack/
│   ├── aix-cli/
│   └── aix-web/
├── docs/
├── Cargo.toml
└── README.zh-CN.md
```

## AIX 承载什么

`.aix` 不只是一个 zip 包，它是一个保留结构语义的 artifact，可以承载：

- 包内文件与版本元信息
- 应用和页面定义
- schema 定义的输入契约
- 布局与目标环境提示
- 面向 AI agents 的派生 tool surface

因此，同一个 `.aix` 包可以被 Rust、CLI 和 Web/WASM 工具链读取，而不丢失其原生结构。

## Packages

### `crates/aix`

核心 crate 定义了 AIX 的读取模型，主要负责：

- 列出包内文件
- 读取归档中的具体文件
- 解析版本和标题元信息
- 解析页面定义
- 提取页面 schema
- 基于包内容推导 tool 定义

关闭默认 feature 后，核心包支持 `no_std + alloc`。

### `crates/aix-pack`

`aix-pack` 完全在内存中构建和优化 `.aix`，负责文本规范化、JSON 紧凑化以及使用纯 Rust 编解码器优化 PNG/JPEG，并由 CLI 和 Web/WASM 共同使用。

### `crates/aix-cli`

CLI 把格式能力转成终端工作流，目前主要包括：

- `aix pack <INPUT_DIR>`：构建 `.aix` artifact
- `aix list <AIX_FILE>` 或 `aix ls <AIX_FILE>`：检查包内容
- `aix optimize <AIX_FILE> -o <OUTPUT_FILE>`：优化已有 artifact
- 打包阶段的校验与规范化处理
- `.aixignore` 支持与可选优化流程

### `crates/aix-web`

Web 包通过 WASM 和 TypeScript 暴露同一套 AIX 能力。

典型接口包括：

- `AIX.From(data)`，从 `Uint8Array` 或 `File` 初始化
- `list()`，获取包内文件
- `readFile(name)`，读取原始文件
- `getVersion()`、`getTitle()`、`getPages()` 和 `getTools()`

这个包对应的官方浏览器入口是 `docs/play.md`，发布后的路由是 `/play`。

## 典型包结构

```text
.
├── AGENTS.md
├── VERSION
├── app.json
├── app.js
└── pages/
```

这些文件通常表示：

- `AGENTS.md`：agent 身份和能力上下文
- `VERSION`：包版本
- `app.json`：应用级元数据和路由配置
- `app.js`：运行时入口逻辑
- `pages/`：页面定义、资源以及包含 schema 的文件

## 快速开始

### 在 Rust 中读取 AIX

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

### 用 CLI 打包或检查

```bash
cargo run -p aiui-aix-cli -- pack ./my-agent -o bundle.aix
```

```bash
cargo run -p aiui-aix-cli -- list ./bundle.aix
```

### 在浏览器中读取 AIX

```ts
import { AIX } from "@yodaos-pkg/aix";

async function inspect(file: File) {
  const aix = await AIX.From(file);
  console.log(aix.getTitle());
  console.log(aix.getPages());
  console.log(aix.getTools());
}
```

## 文档站

文档站位于 `docs/`，当前主要包括三个路由：

- `/spec`：AIX Specification 概览
- `/packages`：workspace 中各 package 的职责
- `/play`：在浏览器里上传并检查真实的 `.aix` artifact

本地启动：

```bash
cd docs
npm install
npm run dev
```

## 开发

在仓库根目录进行基础校验：

```bash
cargo test -p aiui-aix -p aiui-aix-pack -p aiui-aix-cli
cargo check -p aiui-aix-web --target wasm32-unknown-unknown
```

构建 Web 包输出：

```bash
cd crates/aix-web
npm install
npm run build
```

## License

MIT
