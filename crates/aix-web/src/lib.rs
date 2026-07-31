use aix::AixReader;
use aix_pack::{InputFile, OptimizeOptions, PackOptions};
use anyhow::Result;
use wasm_bindgen::prelude::*;

fn to_value<T: serde::Serialize + ?Sized>(value: &T) -> Result<JsValue, JsValue> {
    value
        .serialize(&serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true))
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub struct AixReaderWasm {
    inner: AixReader,
}

#[wasm_bindgen]
pub struct AixPackResultWasm {
    data: Vec<u8>,
    report: aix_pack::OptimizeReport,
}

#[wasm_bindgen]
impl AixPackResultWasm {
    #[wasm_bindgen(getter)]
    pub fn data(&self) -> js_sys::Uint8Array {
        js_sys::Uint8Array::from(self.data.as_slice())
    }

    #[wasm_bindgen(getter)]
    pub fn report(&self) -> Result<JsValue, JsValue> {
        to_value(&self.report)
    }
}

#[wasm_bindgen]
pub fn pack_aix(
    files: JsValue,
    build_id: String,
    optimize_options: JsValue,
) -> Result<AixPackResultWasm, JsValue> {
    let files: Vec<InputFile> = serde_wasm_bindgen::from_value(files)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    let optimize = if optimize_options.is_null() || optimize_options.is_undefined() {
        None
    } else {
        Some(
            serde_wasm_bindgen::from_value(optimize_options)
                .map_err(|error| JsValue::from_str(&error.to_string()))?,
        )
    };
    let output = aix_pack::pack(files, PackOptions { build_id, optimize })
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    Ok(AixPackResultWasm {
        data: output.data,
        report: output.report,
    })
}

#[wasm_bindgen]
pub fn optimize_aix(data: Vec<u8>, options: JsValue) -> Result<AixPackResultWasm, JsValue> {
    let options: OptimizeOptions = if options.is_null() || options.is_undefined() {
        OptimizeOptions::default()
    } else {
        serde_wasm_bindgen::from_value(options)
            .map_err(|error| JsValue::from_str(&error.to_string()))?
    };
    let output = aix_pack::optimize_package(&data, &options)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    Ok(AixPackResultWasm {
        data: output.data,
        report: output.report,
    })
}

#[wasm_bindgen]
impl AixReaderWasm {
    #[wasm_bindgen(constructor)]
    pub fn new(data: Vec<u8>) -> Result<AixReaderWasm, JsValue> {
        let inner = AixReader::new(data).map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(AixReaderWasm { inner })
    }

    pub fn list(&self) -> Result<JsValue, JsValue> {
        to_value(&self.inner.list())
    }

    pub fn read_file(&self, name: &str) -> Result<Vec<u8>, JsValue> {
        self.inner
            .read_file(name)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn get_version(&self) -> Option<String> {
        self.inner.get_version()
    }

    pub fn get_title(&self) -> Option<String> {
        self.inner.get_title()
    }

    pub fn get_pages(&self) -> Result<JsValue, JsValue> {
        to_value(&self.inner.get_pages())
    }

    pub fn get_tools(&self) -> Result<JsValue, JsValue> {
        to_value(&self.inner.get_tools())
    }
}
