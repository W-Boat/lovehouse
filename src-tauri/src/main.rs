#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod updates;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use base64::{engine::general_purpose::STANDARD, Engine};
use tauri::Manager;
static SAVING: AtomicBool=AtomicBool::new(false);

fn export_result(app:&tauri::AppHandle,result:&str){
    if let Some(window)=app.get_webview_window("main"){
        let value=serde_json::to_string(result).unwrap_or_default();
        let _=window.eval(format!("document.dispatchEvent(new CustomEvent('cottage-export-result',{{detail:{}}}))",value));
    }
}
#[tauri::command]
async fn desktop_command(app:tauri::AppHandle,state:tauri::State<'_,updates::Updates>,data:String)->Result<(),String>{
    if data.len()>24_000_000{return Err("导出内容过大".into())}
    let payload:serde_json::Value=serde_json::from_str(&data).map_err(|e|e.to_string())?;
    if payload["kind"]=="content-update" {
        let updates=state.inner().clone();
        let action=payload["action"].as_str().unwrap_or("").to_string();
        let url=payload["url"].as_str().map(str::to_owned);
        tauri::async_runtime::spawn_blocking(move||updates.command(app,&action,url));
        return Ok(())
    }
    if payload["kind"]=="orientation" {return Ok(())}
    if SAVING.swap(true,Ordering::SeqCst){export_result(&app,"busy");return Ok(())}
    tauri::async_runtime::spawn_blocking(move||{
        let result=(||->Result<bool,String>{
            let (bytes,name,extension)=if payload["kind"]=="image" {
                let image=payload["data"].as_str().ok_or("缺少图片")?.strip_prefix("data:image/png;base64,").ok_or("PNG required")?;
                let bytes=STANDARD.decode(image).map_err(|e|e.to_string())?;
                if !bytes.starts_with(&[137,80,78,71,13,10,26,10]){return Err("无效 PNG".into())}
                (bytes,"生日小屋合影.png","png")
            }else if payload["kind"]=="taoyuan-save" {
                let text=payload["data"].as_str().ok_or("缺少存档")?;
                if text.len()>2_000_000{return Err("存档过大".into())}
                (text.as_bytes().to_vec(),"桃源乡存档.tyx","tyx")
            }else{
                if !payload["version"].is_number()||data.len()>2_000_000{return Err("无效存档".into())}
                (data.into_bytes(),"生日小屋存档.json","json")
            };
            let selected=rfd::FileDialog::new().set_file_name(name).add_filter(extension,&[extension]).save_file();
            if let Some(path)=selected{std::fs::write(path,bytes).map_err(|e|e.to_string())?;Ok(true)}else{Ok(false)}
        })();
        SAVING.store(false,Ordering::SeqCst);
        export_result(&app,match result{Ok(true)=>"saved",Ok(false)=>"cancelled",Err(_)=>"error"});
    });
    Ok(())
}


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
    tauri::Builder::default().invoke_handler(tauri::generate_handler![desktop_command]).setup(move |app| {
        use tauri::Manager;
        let local = app.path().app_local_data_dir()?;
        let (storage, mode) = storage_directory(&executable, &local)?;
        let resources=updates::Updates::new(&storage);
        let intercept=resources.clone();
        app.manage(resources);
        let init = format!("window.__storageMode='{}';window.__portableReadonly={};window.CottageDesktop={{postMessage:(data)=>window.__TAURI_INTERNALS__.invoke('desktop_command',{{data}})}};", mode, mode == "system");
        tauri::WebviewWindowBuilder::new(app,"main",tauri::WebviewUrl::App("index.html".into()))
            .title("生日小屋").inner_size(1280.0,800.0).min_inner_size(800.0,500.0)
            .center().resizable(true)
            .data_directory(storage).initialization_script(init.as_str())
            .on_web_resource_request(move|request,response|{
                let path=request.uri().path();
                if let Some(bytes)=intercept.resource(path){
                    let mime=mime_guess::from_path(path).first_or_octet_stream().to_string();
                    *response.status_mut()=tauri::http::StatusCode::OK;
                    response.headers_mut().remove("Content-Encoding");
                    response.headers_mut().remove("Content-Length");
                    if let Ok(value)=mime.parse(){response.headers_mut().insert("Content-Type",value);}
                    *response.body_mut()=std::borrow::Cow::Owned(bytes);
                }
            }).build()?;
        Ok(())
    }).run(tauri::generate_context!()).expect("The birthday cottage could not open");
}
