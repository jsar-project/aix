#![cfg_attr(not(feature = "std"), no_std)]

extern crate alloc;

use alloc::{format, string::String, string::ToString, vec::Vec};
use anyhow::{anyhow, Result};
#[cfg(not(feature = "std"))]
use hashbrown::HashSet;
use serde::{Deserialize, Serialize};
#[cfg(feature = "std")]
use std::collections::HashSet;
#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

#[cfg(feature = "wasm")]
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console, js_name = warn)]
    fn console_warn(s: &str);
}

fn aix_warn(msg: &str) {
    #[cfg(feature = "wasm")]
    console_warn(msg);
    log::warn!("{}", msg);
}
use rawzip::{CompressionMethod, ZipArchive};

pub mod analyzer;
pub mod crypto;
pub mod xml;
pub use analyzer::{PageAnalyzer, PageConstraint};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AixEntry {
    pub name: String,
    pub size: u64,
    pub compressed_size: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PageInfo {
    pub name: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub data_schema: serde_json::Value,
    pub size: PageConstraint,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Tool {
    pub r#type: String,
    pub target: ToolTarget,
    pub layout: PageConstraint,
    pub function: FunctionDefinition,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub enum ToolTarget {
    #[serde(rename = "_current", alias = "current")]
    Current,
    #[serde(rename = "_blank", alias = "blank")]
    Blank,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FunctionDefinition {
    pub name: String,
    pub description: Option<String>,
    pub parameters: serde_json::Value,
}

#[derive(Deserialize)]
struct AppConfig {
    pub pages: Vec<String>,
    pub window: Option<WindowConfig>,
}

#[derive(Deserialize)]
struct WindowConfig {
    #[serde(rename = "navigationBarTitleText")]
    pub navigation_bar_title_text: Option<String>,
}

#[derive(Deserialize, Debug)]
struct PageConfig {
    #[serde(rename = "navigationBarTitleText")]
    pub navigation_bar_title_text: Option<String>,
    pub description: Option<String>,
    pub schema: Option<PageSchema>,
}

#[derive(Deserialize, Debug)]
struct PageSchema {
    pub data: Option<serde_json::Value>,
}

pub struct AixReader {
    entries: Vec<AixEntry>,
    data: Vec<u8>,
}

impl AixReader {
    pub fn new(data: Vec<u8>) -> Result<Self> {
        let mut entries = Vec::new();
        let archive = ZipArchive::from_slice(data.as_slice())
            .map_err(|error| anyhow!("Failed to read zip: {:?}", error))?;
        let mut zip_entries = archive.entries();
        while let Some(file) = zip_entries
            .next_entry()
            .map_err(|error| anyhow!("Failed to read zip entry: {:?}", error))?
        {
            let name = file
                .file_path()
                .try_normalize()
                .map_err(|error| anyhow!("Invalid zip path: {:?}", error))?
                .as_ref()
                .to_string();
            if entries.iter().any(|entry: &AixEntry| entry.name == name) {
                return Err(anyhow!("Duplicate zip entry: {}", name));
            }
            entries.push(AixEntry {
                name,
                size: file.uncompressed_size_hint(),
                compressed_size: file.compressed_size_hint(),
            });
        }

        Ok(Self { entries, data })
    }

    pub fn list(&self) -> &[AixEntry] {
        &self.entries
    }

    pub fn read_file(&self, name: &str) -> Result<Vec<u8>> {
        let archive = ZipArchive::from_slice(self.data.as_slice())
            .map_err(|error| anyhow!("Failed to read zip: {:?}", error))?;
        let mut entries = archive.entries();
        while let Some(entry) = entries
            .next_entry()
            .map_err(|error| anyhow!("Failed to read zip entry: {:?}", error))?
        {
            let path = entry
                .file_path()
                .try_normalize()
                .map_err(|error| anyhow!("Invalid zip path: {:?}", error))?;
            if path.as_ref() != name {
                continue;
            }

            let method = entry.compression_method();
            let local = archive
                .get_entry(entry.wayfinder())
                .map_err(|error| anyhow!("Failed to locate {}: {:?}", name, error))?;
            let claimed = local.claim_verifier();
            let limit = usize::try_from(claimed.uncompressed_size)
                .map_err(|_| anyhow!("File too large: {}", name))?;
            let output = match method {
                CompressionMethod::STORE => local.data().to_vec(),
                CompressionMethod::DEFLATE => {
                    miniz_oxide::inflate::decompress_to_vec_with_limit(local.data(), limit)
                        .map_err(|error| anyhow!("Failed to extract {}: {}", name, error))?
                }
                _ => return Err(anyhow!("Unsupported compression for {}: {}", name, method)),
            };
            let actual = rawzip::ZipVerification {
                crc: rawzip::crc32(&output),
                uncompressed_size: output.len() as u64,
            };
            claimed
                .valid(actual)
                .map_err(|error| anyhow!("Failed to verify {}: {:?}", name, error))?;
            return Ok(output);
        }
        Err(anyhow!("File not found: {}", name))
    }

    pub fn get_version(&self) -> Option<String> {
        self.read_file("VERSION")
            .ok()
            .and_then(|v| String::from_utf8(v).ok())
    }

    /// Reads the package manifest. Older packages may not contain one.
    pub fn get_manifest(&self) -> Result<Option<crypto::PackageManifest>> {
        if !self
            .entries
            .iter()
            .any(|entry| entry.name == crypto::MANIFEST_PATH)
        {
            return Ok(None);
        }

        let data = self.read_file(crypto::MANIFEST_PATH)?;
        serde_json::from_slice(&data)
            .map(Some)
            .map_err(|error| anyhow!("Invalid AIX manifest: {}", error))
    }

    /// Returns whether this package supports the supplied engine version.
    pub fn supports_engine(&self, current_version: &str) -> Result<bool> {
        let manifest = self
            .get_manifest()?
            .ok_or_else(|| anyhow!("AIX manifest not found"))?;
        crypto::engine_satisfies(&manifest.engine, current_version)
            .map_err(|error| anyhow!("Invalid engine version or range: {}", error))
    }

    /// Verifies the manifest signature and every package entry against a trusted key.
    pub fn verify_signature(
        &self,
        trusted_key: &crypto::PublicKey,
    ) -> Result<crypto::VerificationReport> {
        let manifest_data = self.read_file(crypto::MANIFEST_PATH)?;
        let manifest: crypto::PackageManifest = serde_json::from_slice(&manifest_data)
            .map_err(|error| anyhow!("Invalid AIX manifest: {}", error))?;
        if manifest.format != "aix"
            || manifest.algorithm != "ed25519"
            || manifest.digest != "sha256"
        {
            return Err(anyhow!("Unsupported AIX signature manifest"));
        }
        crypto::validate_engine_range(&manifest.engine)
            .map_err(|error| anyhow!("Invalid engine range: {}", error))?;
        if manifest.key_id != trusted_key.key_id() {
            return Err(anyhow!("Manifest key ID does not match trusted key"));
        }

        let signature_data = self.read_file(crypto::SIGNATURE_PATH)?;
        let signature_bytes: [u8; 64] = signature_data
            .try_into()
            .map_err(|_| anyhow!("Invalid Ed25519 signature length"))?;
        let signature = crypto::Signature::from_bytes(signature_bytes);
        trusted_key
            .verify(b"package-manifest", &manifest_data, &signature)
            .map_err(|error| anyhow!("AIX signature verification failed: {}", error))?;

        let mut previous: Option<&str> = None;
        for entry in &manifest.entries {
            if previous.is_some_and(|path| path.as_bytes() >= entry.path.as_bytes())
                || entry.path.starts_with("META-INF/aix/")
            {
                return Err(anyhow!(
                    "Invalid or unsorted manifest entry: {}",
                    entry.path
                ));
            }
            let data = self.read_file(&entry.path)?;
            if data.len() as u64 != entry.size || crypto::sha256(&data) != entry.sha256 {
                return Err(anyhow!("Package entry digest mismatch: {}", entry.path));
            }
            previous = Some(&entry.path);
        }
        let signed_paths: HashSet<&str> = manifest
            .entries
            .iter()
            .map(|entry| entry.path.as_str())
            .collect();
        for entry in &self.entries {
            if entry.name.ends_with('/') || entry.name.starts_with(crypto::METADATA_PREFIX) {
                continue;
            }
            if !signed_paths.contains(entry.name.as_str()) {
                return Err(anyhow!("Unsigned package entry: {}", entry.name));
            }
        }
        let version = self
            .get_version()
            .ok_or_else(|| anyhow!("VERSION entry not found"))?;
        if manifest.version != version {
            return Err(anyhow!("Manifest version does not match VERSION"));
        }
        if crypto::calculate_package_id(&manifest.entries) != manifest.package_id {
            return Err(anyhow!("Manifest package ID mismatch"));
        }

        Ok(crypto::VerificationReport {
            package_id: manifest.package_id,
            version: manifest.version,
            engine: manifest.engine,
            key_id: manifest.key_id,
            entry_count: manifest.entries.len(),
        })
    }

    pub fn get_title(&self) -> Option<String> {
        let app_json = self.read_file("app.json").ok()?;
        let config: AppConfig = serde_json::from_slice(&app_json).ok()?;
        config.window.and_then(|w| w.navigation_bar_title_text)
    }

    pub fn get_pages(&self) -> Vec<PageInfo> {
        let mut pages = Vec::new();
        if let Ok(app_json) = self.read_file("app.json") {
            if let Ok(config) = serde_json::from_slice::<AppConfig>(&app_json) {
                for path in config.pages {
                    let mut title = None;
                    let mut description = None;
                    let mut data_schema = serde_json::json!({});
                    let mut size = PageConstraint::default();

                    // Check if it's an SFC (.ink file) first
                    let ink_path = format!("{}.ink", path);
                    if let Ok(ink_content) = self
                        .read_file(&ink_path)
                        .and_then(|b| String::from_utf8(b).map_err(|e| anyhow::anyhow!(e)))
                    {
                        // Extract config from <script def> and template/style for analyzer
                        if let Ok(nodes) = xml::parse_sfc(&ink_content) {
                            for node in &nodes {
                                if let xml::Node::Element {
                                    name,
                                    attributes,
                                    children,
                                } = node
                                {
                                    if name == "script" && attributes.contains_key("def") {
                                        if let Some(xml::Node::Text(text)) = children.first() {
                                            if let Ok(page_config) =
                                                serde_json::from_str::<PageConfig>(text)
                                            {
                                                title = page_config.navigation_bar_title_text;
                                                description = page_config.description;
                                                match page_config.schema {
                                                    Some(schema) => match schema.data {
                                                        Some(data) => {
                                                            data_schema = data;
                                                        }
                                                        None => {
                                                            aix_warn(&format!(
                                                                "Missing 'data' in schema for page: {}",
                                                                path
                                                            ));
                                                        }
                                                    },
                                                    None => {
                                                        aix_warn(&format!(
                                                            "Missing 'schema' for page: {}",
                                                            path
                                                        ));
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        size = PageAnalyzer::analyze_sfc(&ink_content);
                    } else {
                        // Fallback to traditional files
                        let json_path = format!("{}.json", path);
                        if let Ok(page_json) = self.read_file(&json_path) {
                            if let Ok(page_config) =
                                serde_json::from_slice::<PageConfig>(&page_json)
                            {
                                title = page_config.navigation_bar_title_text;
                                description = page_config.description;
                                match page_config.schema {
                                    Some(schema) => match schema.data {
                                        Some(data) => {
                                            data_schema = data;
                                        }
                                        None => {
                                            aix_warn(&format!(
                                                "Missing 'data' in schema for page: {}",
                                                path
                                            ));
                                        }
                                    },
                                    None => {
                                        aix_warn(&format!("Missing 'schema' for page: {}", path));
                                    }
                                }
                            }
                        }

                        // Analyze page size
                        let wxml = self
                            .read_file(&format!("{}.wxml", path))
                            .ok()
                            .and_then(|b| String::from_utf8(b).ok());
                        let wcss = self
                            .read_file(&format!("{}.wcss", path))
                            .or_else(|_| self.read_file(&format!("{}.wxss", path)))
                            .ok()
                            .and_then(|b| String::from_utf8(b).ok());

                        if wxml.is_some() {
                            size = PageAnalyzer::analyze(wxml.as_deref(), wcss.as_deref());
                        }
                    }

                    pages.push(PageInfo {
                        name: path,
                        title,
                        description,
                        data_schema,
                        size,
                    });
                }
            }
        }
        pages
    }

    pub fn get_tools(&self) -> Vec<Tool> {
        let pages = self.get_pages();
        let mut tools = Vec::new();

        for (index, page) in pages.into_iter().enumerate() {
            let has_parameters = page_has_parameters(&page.data_schema);
            let name = page.name;
            let description = page.description.or(page.title);
            let layout = page.size;
            let parameters = page.data_schema;

            let current_tool = Tool {
                r#type: "function".to_string(),
                target: ToolTarget::Current,
                layout,
                function: FunctionDefinition {
                    name: name.clone(),
                    description: description.clone(),
                    parameters,
                },
            };

            if index == 0 {
                if has_parameters {
                    tools.push(current_tool);
                } else {
                    tools.push(Tool {
                        r#type: "function".to_string(),
                        target: ToolTarget::Blank,
                        layout,
                        function: FunctionDefinition {
                            name,
                            description,
                            parameters: serde_json::json!({}),
                        },
                    });
                }
            } else {
                tools.push(current_tool);
            }
        }

        tools
    }
}

fn page_has_parameters(data_schema: &serde_json::Value) -> bool {
    if data_schema.is_null() {
        return false;
    }

    let Some(map) = data_schema.as_object() else {
        return true;
    };

    if map.is_empty() {
        return false;
    }

    let is_empty_object_schema = matches!(
        map.get("type").and_then(serde_json::Value::as_str),
        Some("object")
    ) && matches!(map.get("properties"), Some(serde_json::Value::Object(properties)) if properties.is_empty());

    !is_empty_object_schema
}

pub fn format_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} bytes", bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Cursor, Write};
    use zip::write::FileOptions;

    fn create_test_aix() -> Vec<u8> {
        let mut buf = Vec::new();
        {
            let mut zip = zip::ZipWriter::new(Cursor::new(&mut buf));
            let options = FileOptions::default();

            zip.start_file("app.json", options).unwrap();
            zip.write_all(
                br#"{
                "pages": ["pages/index/index"],
                "window": { "navigationBarTitleText": "Test App" }
            }"#,
            )
            .unwrap();

            zip.start_file("pages/index/index.json", options).unwrap();
            zip.write_all(
                br#"{
                "navigationBarTitleText": "Index Page",
                "schema": {
                    "data": {
                        "type": "object",
                        "properties": {
                            "test": { "type": "string" }
                        }
                    }
                }
            }"#,
            )
            .unwrap();

            zip.start_file("pages/index/index.wxml", options).unwrap();
            zip.write_all(br#"<view class="container"></view>"#)
                .unwrap();

            zip.start_file("pages/index/index.wxss", options).unwrap();
            zip.write_all(br#".container { width: 100px; height: 100px; }"#)
                .unwrap();

            zip.finish().unwrap();
        }
        buf
    }

    #[test]
    fn reads_deflated_entries() {
        let mut data = Vec::new();
        {
            let mut zip = zip::ZipWriter::new(Cursor::new(&mut data));
            let options =
                FileOptions::default().compression_method(zip::CompressionMethod::Deflated);
            zip.start_file("app.json", options).unwrap();
            zip.write_all(br#"{"pages":[]}"#).unwrap();
            zip.finish().unwrap();
        }

        let reader = AixReader::new(data).unwrap();
        assert_eq!(reader.read_file("app.json").unwrap(), br#"{"pages":[]}"#);
    }

    #[test]
    fn missing_manifest_returns_none() {
        let reader = AixReader::new(create_test_aix()).unwrap();
        assert!(reader.get_manifest().unwrap().is_none());
    }

    #[test]
    fn corrupt_manifest_propagates_read_error() {
        let manifest = br#"{"format":"aix"}"#;
        let mut data = Vec::new();
        {
            let mut zip = zip::ZipWriter::new(Cursor::new(&mut data));
            let options = FileOptions::default().compression_method(zip::CompressionMethod::Stored);
            zip.start_file(crypto::MANIFEST_PATH, options).unwrap();
            zip.write_all(manifest).unwrap();
            zip.finish().unwrap();
        }
        let offset = data
            .windows(manifest.len())
            .position(|window| window == manifest)
            .unwrap();
        data[offset] ^= 1;

        let reader = AixReader::new(data).unwrap();
        let error = reader.get_manifest().unwrap_err();
        assert!(error.to_string().contains("Failed to verify"));
    }

    #[test]
    fn test_aix_reader_metadata() {
        let data = create_test_aix();
        let reader = AixReader::new(data).unwrap();

        assert_eq!(reader.get_title(), Some("Test App".to_string()));

        let pages = reader.get_pages();
        assert_eq!(pages.len(), 1);
        assert_eq!(pages[0].name, "pages/index/index");
        assert_eq!(pages[0].title, Some("Index Page".to_string()));
        assert_eq!(pages[0].data_schema["type"], "object");
        assert_eq!(pages[0].size.width, 100.0);
        assert_eq!(pages[0].size.height, 100.0);

        let tools = reader.get_tools();
        assert_eq!(tools.len(), 1);
        assert_eq!(tools[0].function.name, "pages/index/index");
        assert_eq!(tools[0].target, ToolTarget::Current);
        assert_eq!(
            tools[0].function.description,
            Some("Index Page".to_string())
        );
        assert_eq!(tools[0].function.parameters["type"], "object");
        assert_eq!(tools[0].layout.width, 100.0);
        assert_eq!(tools[0].layout.height, 100.0);

        let tool_json = serde_json::to_value(&tools[0]).unwrap();
        assert_eq!(tool_json["target"], "_current");
        assert_eq!(tool_json["function"]["parameters"]["type"], "object");
    }

    fn create_test_sfc_aix() -> Vec<u8> {
        let mut buf = Vec::new();
        {
            let mut zip = zip::ZipWriter::new(Cursor::new(&mut buf));
            let options = FileOptions::default();

            zip.start_file("app.json", options).unwrap();
            zip.write_all(
                br#"{
                "pages": ["pages/sfc_page/index"],
                "window": { "navigationBarTitleText": "Test SFC App" }
            }"#,
            )
            .unwrap();

            zip.start_file("pages/sfc_page/index.ink", options).unwrap();
            zip.write_all(
                br#"
<script def>
{
    "navigationBarTitleText": "SFC Page",
    "schema": {
        "data": {
            "type": "string"
        }
    }
}
</script>
<page>
    <view class="container"></view>
</page>
<style>
.container { width: 120px; height: 120px; }
</style>
"#,
            )
            .unwrap();

            zip.finish().unwrap();
        }
        buf
    }

    #[test]
    fn test_aix_reader_sfc() {
        let data = create_test_sfc_aix();
        let reader = AixReader::new(data).unwrap();

        assert_eq!(reader.get_title(), Some("Test SFC App".to_string()));

        let pages = reader.get_pages();
        assert_eq!(pages.len(), 1);
        assert_eq!(pages[0].name, "pages/sfc_page/index");
        assert_eq!(pages[0].title, Some("SFC Page".to_string()));
        assert_eq!(pages[0].data_schema["type"], "string");
        assert_eq!(pages[0].size.width, 120.0);
        assert_eq!(pages[0].size.height, 120.0);
    }

    fn create_test_aix_wcss() -> Vec<u8> {
        let mut buf = Vec::new();
        {
            let mut zip = zip::ZipWriter::new(Cursor::new(&mut buf));
            let options = FileOptions::default();

            zip.start_file("app.json", options).unwrap();
            zip.write_all(
                br#"{
                "pages": ["pages/index/index"],
                "window": { "navigationBarTitleText": "WCSS Test App" }
            }"#,
            )
            .unwrap();

            zip.start_file("pages/index/index.json", options).unwrap();
            zip.write_all(
                br#"{
                "navigationBarTitleText": "WCSS Page",
                "schema": { "data": { "type": "object" } }
            }"#,
            )
            .unwrap();

            zip.start_file("pages/index/index.wxml", options).unwrap();
            zip.write_all(br#"<view class="wrapper"></view>"#).unwrap();

            // Use .wcss extension (preferred over .wxss)
            zip.start_file("pages/index/index.wcss", options).unwrap();
            zip.write_all(br#".wrapper { width: 240px; height: 80px; }"#)
                .unwrap();

            zip.finish().unwrap();
        }
        buf
    }

    #[test]
    fn test_aix_reader_wcss_extension() {
        let data = create_test_aix_wcss();
        let reader = AixReader::new(data).unwrap();

        let pages = reader.get_pages();
        assert_eq!(pages.len(), 1);
        assert_eq!(pages[0].size.width, 240.0);
        assert_eq!(pages[0].size.height, 80.0);
    }

    fn create_test_aix_no_dimensions() -> Vec<u8> {
        let mut buf = Vec::new();
        {
            let mut zip = zip::ZipWriter::new(Cursor::new(&mut buf));
            let options = FileOptions::default();

            zip.start_file("app.json", options).unwrap();
            zip.write_all(
                br#"{
                "pages": ["pages/index/index"],
                "window": { "navigationBarTitleText": "No Dim App" }
            }"#,
            )
            .unwrap();

            zip.start_file("pages/index/index.json", options).unwrap();
            zip.write_all(
                br#"{
                "navigationBarTitleText": "No Dim Page",
                "schema": { "data": { "type": "object" } }
            }"#,
            )
            .unwrap();

            zip.start_file("pages/index/index.wxml", options).unwrap();
            zip.write_all(br#"<view class="container"></view>"#)
                .unwrap();

            // CSS has no width/height properties
            zip.start_file("pages/index/index.wxss", options).unwrap();
            zip.write_all(br#".container { color: blue; background: white; }"#)
                .unwrap();

            zip.finish().unwrap();
        }
        buf
    }

    #[test]
    fn test_aix_reader_default_size_when_no_dimensions() {
        let data = create_test_aix_no_dimensions();
        let reader = AixReader::new(data).unwrap();

        let pages = reader.get_pages();
        assert_eq!(pages.len(), 1);
        // Should fall back to default dimensions
        assert_eq!(pages[0].size.width, PageConstraint::default().width);
        assert_eq!(pages[0].size.height, PageConstraint::default().height);
    }

    fn create_test_aix_multiple_pages() -> Vec<u8> {
        let mut buf = Vec::new();
        {
            let mut zip = zip::ZipWriter::new(Cursor::new(&mut buf));
            let options = FileOptions::default();

            zip.start_file("app.json", options).unwrap();
            zip.write_all(
                br#"{
                "pages": ["pages/home/index", "pages/detail/index"],
                "window": { "navigationBarTitleText": "Multi Page App" }
            }"#,
            )
            .unwrap();

            // First page: traditional files
            zip.start_file("pages/home/index.json", options).unwrap();
            zip.write_all(
                br#"{
                "navigationBarTitleText": "Home",
                "description": "Home page",
                "schema": { "data": { "type": "object" } }
            }"#,
            )
            .unwrap();
            zip.start_file("pages/home/index.wxml", options).unwrap();
            zip.write_all(br#"<view class="home"></view>"#).unwrap();
            zip.start_file("pages/home/index.wxss", options).unwrap();
            zip.write_all(br#".home { width: 480px; height: 168px; }"#)
                .unwrap();

            // Second page: SFC format
            zip.start_file("pages/detail/index.ink", options).unwrap();
            zip.write_all(
                br#"
<script def>
{
    "navigationBarTitleText": "Detail",
    "description": "Detail page",
    "schema": { "data": { "type": "string" } }
}
</script>
<page>
<view class="detail"></view>
</page>
<style>
.detail { width: 320px; height: 240px; }
</style>
"#,
            )
            .unwrap();

            zip.finish().unwrap();
        }
        buf
    }

    #[test]
    fn test_aix_reader_multiple_pages() {
        let data = create_test_aix_multiple_pages();
        let reader = AixReader::new(data).unwrap();

        let pages = reader.get_pages();
        assert_eq!(pages.len(), 2);

        // First page: traditional files
        assert_eq!(pages[0].name, "pages/home/index");
        assert_eq!(pages[0].title, Some("Home".to_string()));
        assert_eq!(pages[0].size.width, 480.0);
        assert_eq!(pages[0].size.height, 168.0);

        // Second page: SFC format
        assert_eq!(pages[1].name, "pages/detail/index");
        assert_eq!(pages[1].title, Some("Detail".to_string()));
        assert_eq!(pages[1].size.width, 320.0);
        assert_eq!(pages[1].size.height, 240.0);

        let tools = reader.get_tools();
        assert_eq!(tools.len(), 2);
        assert_eq!(tools[1].target, ToolTarget::Current);
        assert_eq!(tools[0].target, ToolTarget::Current);
        assert_eq!(tools[0].function.name, "pages/home/index");
        assert_eq!(tools[1].function.name, "pages/detail/index");
        assert_eq!(tools[0].function.parameters["type"], "object");
        assert_eq!(tools[1].function.parameters["type"], "string");
        assert_eq!(tools[0].layout.width, 480.0);
        assert_eq!(tools[0].layout.height, 168.0);
        assert_eq!(tools[1].layout.width, 320.0);
        assert_eq!(tools[1].layout.height, 240.0);
    }

    fn create_test_aix_empty_schema_first_page() -> Vec<u8> {
        let mut buf = Vec::new();
        {
            let mut zip = zip::ZipWriter::new(Cursor::new(&mut buf));
            let options = FileOptions::default();

            zip.start_file("app.json", options).unwrap();
            zip.write_all(
                br#"{
                "pages": ["pages/home/index", "pages/detail/index"],
                "window": { "navigationBarTitleText": "Empty Schema App" }
            }"#,
            )
            .unwrap();

            zip.start_file("pages/home/index.json", options).unwrap();
            zip.write_all(
                br#"{
                "navigationBarTitleText": "Home",
                "description": "Home page",
                "schema": { "data": {} }
            }"#,
            )
            .unwrap();
            zip.start_file("pages/home/index.wxml", options).unwrap();
            zip.write_all(br#"<view class="home"></view>"#).unwrap();
            zip.start_file("pages/home/index.wxss", options).unwrap();
            zip.write_all(br#".home { width: 200px; height: 100px; }"#)
                .unwrap();

            zip.start_file("pages/detail/index.json", options).unwrap();
            zip.write_all(
                br#"{
                "navigationBarTitleText": "Detail",
                "description": "Detail page",
                "schema": { "data": { "type": "object" } }
            }"#,
            )
            .unwrap();
            zip.start_file("pages/detail/index.wxml", options).unwrap();
            zip.write_all(br#"<view class="detail"></view>"#).unwrap();
            zip.start_file("pages/detail/index.wxss", options).unwrap();
            zip.write_all(br#".detail { width: 300px; height: 150px; }"#)
                .unwrap();

            zip.finish().unwrap();
        }
        buf
    }

    #[test]
    fn test_aix_reader_first_page_without_parameters_only_blank() {
        let data = create_test_aix_empty_schema_first_page();
        let reader = AixReader::new(data).unwrap();

        let tools = reader.get_tools();
        assert_eq!(tools.len(), 2);
        assert_eq!(tools[0].target, ToolTarget::Blank);
        assert_eq!(tools[0].function.name, "pages/home/index");
        assert_eq!(tools[0].function.parameters, serde_json::json!({}));
        assert_eq!(tools[1].target, ToolTarget::Current);
        assert_eq!(tools[1].function.name, "pages/detail/index");
    }

    fn create_test_aix_empty_properties_schema_first_page() -> Vec<u8> {
        let mut buf = Vec::new();
        {
            let mut zip = zip::ZipWriter::new(Cursor::new(&mut buf));
            let options = FileOptions::default();

            zip.start_file("app.json", options).unwrap();
            zip.write_all(
                br#"{
                "pages": ["pages/home/index", "pages/detail/index"],
                "window": { "navigationBarTitleText": "Empty Properties App" }
            }"#,
            )
            .unwrap();

            zip.start_file("pages/home/index.json", options).unwrap();
            zip.write_all(
                br#"{
                "navigationBarTitleText": "Home",
                "description": "Home page",
                "schema": {
                    "data": {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                }
            }"#,
            )
            .unwrap();
            zip.start_file("pages/home/index.wxml", options).unwrap();
            zip.write_all(br#"<view class="home"></view>"#).unwrap();
            zip.start_file("pages/home/index.wxss", options).unwrap();
            zip.write_all(br#".home { width: 200px; height: 100px; }"#)
                .unwrap();

            zip.start_file("pages/detail/index.json", options).unwrap();
            zip.write_all(
                br#"{
                "navigationBarTitleText": "Detail",
                "description": "Detail page",
                "schema": { "data": { "type": "object", "properties": { "id": { "type": "string" } } } }
            }"#,
            )
            .unwrap();
            zip.start_file("pages/detail/index.wxml", options).unwrap();
            zip.write_all(br#"<view class="detail"></view>"#).unwrap();
            zip.start_file("pages/detail/index.wxss", options).unwrap();
            zip.write_all(br#".detail { width: 300px; height: 150px; }"#)
                .unwrap();

            zip.finish().unwrap();
        }
        buf
    }

    #[test]
    fn test_aix_reader_first_page_empty_properties_schema_is_blank() {
        let data = create_test_aix_empty_properties_schema_first_page();
        let reader = AixReader::new(data).unwrap();

        let tools = reader.get_tools();
        assert_eq!(tools.len(), 2);
        assert_eq!(tools[0].target, ToolTarget::Blank);
        assert_eq!(tools[0].function.name, "pages/home/index");
        assert_eq!(tools[0].function.parameters, serde_json::json!({}));
        assert_eq!(tools[1].target, ToolTarget::Current);
        assert_eq!(tools[1].function.name, "pages/detail/index");
    }

    fn create_test_sfc_aix_inline_style() -> Vec<u8> {
        let mut buf = Vec::new();
        {
            let mut zip = zip::ZipWriter::new(Cursor::new(&mut buf));
            let options = FileOptions::default();

            zip.start_file("app.json", options).unwrap();
            zip.write_all(
                br#"{
                "pages": ["pages/inline/index"],
                "window": { "navigationBarTitleText": "Inline Style App" }
            }"#,
            )
            .unwrap();

            zip.start_file("pages/inline/index.ink", options).unwrap();
            zip.write_all(
                br#"
<script def>
{
    "navigationBarTitleText": "Inline Style Page",
    "schema": { "data": { "type": "object" } }
}
</script>
<page>
<view style="width: 400px; height: 180px;"></view>
</page>
<style>
</style>
"#,
            )
            .unwrap();

            zip.finish().unwrap();
        }
        buf
    }

    #[test]
    fn test_aix_reader_sfc_inline_style() {
        let data = create_test_sfc_aix_inline_style();
        let reader = AixReader::new(data).unwrap();

        let pages = reader.get_pages();
        assert_eq!(pages.len(), 1);
        assert_eq!(pages[0].title, Some("Inline Style Page".to_string()));
        assert_eq!(pages[0].size.width, 400.0);
        assert_eq!(pages[0].size.height, 180.0);
    }
}
