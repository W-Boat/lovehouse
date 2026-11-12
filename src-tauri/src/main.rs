#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() {
    let executable = std::env::current_exe().expect("Cannot find executable");
    let base = executable.parent().unwrap();
    let portable = base.join("lovehouse-data");
    let writable = std::fs::create_dir_all(&portable).and_then(|_|std::fs::write(portable.join(".write-check"), b"ok")).is_ok();
    let builder = tauri::Builder::default();
    builder.setup(move |app| {
        use tauri::Manager;
        let mut window=tauri::WebviewWindowBuilder::new(app,"main",tauri::WebviewUrl::App("index.html".into())).title("生日小屋").inner_size(1280.0,800.0).min_inner_size(800.0,500.0);
        if writable { window=window.data_directory(portable.clone()); }
        let view=window.build()?;
        if !writable { view.eval("window.__portableReadonly=true;window.dispatchEvent(new CustomEvent('portable-readonly'))")?; }
        Ok(())
    }).run(tauri::generate_context!()).expect("The birthday cottage could not open");
}
