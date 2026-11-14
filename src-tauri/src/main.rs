#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::path::{Path, PathBuf};

fn writable_directory(path: &Path) -> bool {
    if std::fs::create_dir_all(path).is_err() { return false; }
    let probe = path.join(format!(".write-check-{}", std::process::id()));
    if std::fs::write(&probe, b"ok").is_err() { return false; }
    let _ = std::fs::remove_file(probe);
    true
}

fn storage_directory(executable: &Path, local: &Path) -> std::io::Result<(PathBuf, &'static str)> {
    let portable = executable.parent().unwrap().join("lovehouse-data");
    if writable_directory(&portable) { return Ok((portable, "portable")); }
    std::fs::create_dir_all(local)?;
    let preference = local.join("chosen-storage.txt");
    if let Ok(text) = std::fs::read_to_string(&preference) {
        let previous = PathBuf::from(text.trim());
        if previous.is_absolute() && writable_directory(&previous) { return Ok((previous, "chosen")); }
    }
    loop {
        let selected = rfd::FileDialog::new()
            .set_title("这里无法保存进度，请为生日小屋选择一个可写文件夹；取消则保存在这台电脑")
            .pick_folder();
        let Some(folder) = selected else { break; };
        let chosen = folder.join("lovehouse-data");
        if writable_directory(&chosen) {
            std::fs::write(&preference, chosen.to_string_lossy().as_bytes())?;
            return Ok((chosen, "chosen"));
        }
    }
    let fallback = local.join("webview");
    if writable_directory(&fallback) { Ok((fallback, "system")) }
    else { Err(std::io::Error::new(std::io::ErrorKind::PermissionDenied, "无法创建存档目录，请将小屋移到可写文件夹后重试。")) }
}

fn main() {
    let executable = std::env::current_exe().expect("Cannot find executable");
    tauri::Builder::default().setup(move |app| {
        use tauri::Manager;
        let local = app.path().app_local_data_dir()?;
        let (storage, mode) = storage_directory(&executable, &local)?;
        let init = format!("window.__storageMode='{}';window.__portableReadonly={};", mode, mode == "system");
        tauri::WebviewWindowBuilder::new(app,"main",tauri::WebviewUrl::App("index.html".into()))
            .title("生日小屋").inner_size(1280.0,800.0).min_inner_size(800.0,500.0)
            .center().resizable(true)
            .data_directory(storage).initialization_script(init.as_str()).build()?;
        Ok(())
    }).run(tauri::generate_context!()).expect("The birthday cottage could not open");
}
