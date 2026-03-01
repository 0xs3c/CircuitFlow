mod codegen;

use codegen::{GenerateCodeRequest, GenerateCodeResponse};

#[tauri::command]
fn generate_code(request: GenerateCodeRequest) -> Result<GenerateCodeResponse, String> {
    codegen::generate(request)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![generate_code])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}