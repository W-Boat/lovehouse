use base64::{engine::general_purpose::STANDARD, Engine};
use rsa::{pkcs8::DecodePublicKey, pkcs1v15::{VerifyingKey, Signature}, signature::Verifier, RsaPublicKey};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, fs, io::{Read, Write}, path::{Component, Path, PathBuf}, sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}}, time::Duration};
use tauri::Manager;

#[derive(Clone, Deserialize, Serialize)]
pub struct Resource { bytes: u64, sha256: String }
#[derive(Clone, Deserialize, Serialize)]
pub struct Manifest {
    format: u32, pub version: u64, #[serde(rename="requiredNativeApi")] native_api: u32,
    entry: String, #[serde(rename="blobDirectory")] blobs: String,
    #[serde(rename="builtAt", default)] pub built_at: u64,
    pub files: BTreeMap<String, Resource>,
}
#[derive(Clone, Default, Deserialize, Serialize)]
struct Versions { active: Option<u64>, previous: Option<u64>, pending: Option<u64>, trial: bool, failed: Option<u64> }

#[derive(Clone)]
pub struct Updates {
    root: PathBuf, versions: Arc<Mutex<Versions>>, busy: Arc<AtomicBool>,
    pub active: Option<(PathBuf, Manifest)>,
}
fn digest(bytes: &[u8]) -> String { format!("{:x}", Sha256::digest(bytes)) }
fn relative(name: &str) -> bool {
    !name.is_empty() && !name.contains(['\\', ':', '%', '\0'])
        && Path::new(name).components().all(|c| matches!(c, Component::Normal(_)))
        && !name.split('/').any(|part| part.is_empty() || part.starts_with('.'))
}
fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or("Missing parent")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let mut file = tempfile::NamedTempFile::new_in(parent).map_err(|e|e.to_string())?;
    file.write_all(bytes).map_err(|e|e.to_string())?;
    file.as_file().sync_all().map_err(|e|e.to_string())?;
    file.persist(path).map_err(|e|e.to_string())?;
    Ok(())
}
fn manifest(bytes: &[u8]) -> Result<Manifest, String> {
    if bytes.len()>3_000_000 { return Err("清单过大".into()) }
    let envelope: Value=serde_json::from_slice(bytes).map_err(|e|e.to_string())?;
    let payload=STANDARD.decode(envelope["payload"].as_str().ok_or("缺少签名内容")?).map_err(|e|e.to_string())?;
    let signature=STANDARD.decode(envelope["signature"].as_str().ok_or("缺少签名")?).map_err(|e|e.to_string())?;
    let key=RsaPublicKey::from_public_key_pem(include_str!("update-public.pem")).map_err(|e|e.to_string())?;
    VerifyingKey::<Sha256>::new(key).verify(&payload,&Signature::try_from(signature.as_slice()).map_err(|e|e.to_string())?).map_err(|_|"资源签名无效")?;
    let result: Manifest=serde_json::from_slice(&payload).map_err(|e|e.to_string())?;
    if result.format!=1 || result.native_api!=1 || result.version==0 || result.version>2147483647
        || result.entry!="index.html" || result.blobs!="blobs/" || result.files.len()>4096 || !result.files.contains_key("index.html")
        || result.files.iter().any(|(name,spec)|!relative(name)||spec.bytes>200_000_000||spec.sha256.len()!=64||!spec.sha256.bytes().all(|c|c.is_ascii_hexdigit()))
        || result.files.values().map(|spec|spec.bytes).sum::<u64>()>600_000_000 { return Err("资源清单无效".into()) }
    Ok(result)
}
impl Updates {
    pub fn new(storage: &Path) -> Self {
        let root=storage.join("resource-updates");
        let mut versions: Versions=fs::read(root.join("state.json")).ok().and_then(|v|serde_json::from_slice(&v).ok()).unwrap_or_default();
        if versions.trial { versions.failed=versions.active; versions.active=versions.previous.take(); versions.trial=false; }
        if let Some(pending)=versions.pending.take() {
            versions.previous=versions.active;versions.active=Some(pending);versions.trial=true;
        }
        let mut active=None;
        if let Some(version)=versions.active {
            let path=root.join(version.to_string());
            let candidate=fs::read(path.join("update.json")).ok().and_then(|data|manifest(&data).ok());
            if let Some(data)=candidate.filter(|m|m.built_at>env!("LOVEHOUSE_BUILD_EPOCH").parse().unwrap_or(u64::MAX)) {
                let valid=data.files.iter().all(|(name,spec)|fs::read(path.join(name)).map(|bytes|bytes.len() as u64==spec.bytes&&digest(&bytes)==spec.sha256).unwrap_or(false));
                if valid { active=Some((path,data)); }
            }
            if active.is_none() { versions.active=None;versions.trial=false; }
        }
        let this=Self{root,versions:Arc::new(Mutex::new(versions)),busy:Arc::new(AtomicBool::new(false)),active};
        let _=this.save_state();this
    }
    fn save_state(&self)->Result<(),String> {
        let data=serde_json::to_vec(&*self.versions.lock().map_err(|_|"资源状态不可用")?).map_err(|e|e.to_string())?;
        atomic_write(&self.root.join("state.json"),&data)
    }
    fn event(&self,app:&tauri::AppHandle,phase:&str,message:&str,progress:u64) {
        let version=self.active.as_ref().map(|(_,m)|m.version).unwrap_or(0);
        let detail=json!({"phase":phase,"message":message,"progress":progress,"version":version,"availableVersion":self.versions.lock().ok().and_then(|v|v.pending).unwrap_or(0),"url":format!("{}/android-update/update.json",env!("LOVEHOUSE_CONTENT_SERVER").trim_end_matches('/'))});
        if let Some(window)=app.get_webview_window("main"){
            let _=window.eval(format!("document.dispatchEvent(new CustomEvent('cottage-update-status',{{detail:{}}}))",detail));
        }
    }
    pub fn command(&self,app:tauri::AppHandle,action:&str,url:Option<String>) {
        if action=="ready" {
            if let Ok(mut state)=self.versions.lock(){state.trial=false;}
            let _=self.save_state();self.event(&app,"current","资源已就绪",100);return
        }
        if action=="status" {self.event(&app,"current","资源状态已读取",100);return}
        if action=="install"||action=="rollback" {
            if self.busy.load(Ordering::SeqCst){self.event(&app,"busy","资源仍在准备中",0);return}
            if action=="rollback" {
                if let Ok(mut state)=self.versions.lock(){
                    state.failed=state.active;state.pending=state.previous;state.trial=false;
                    if state.previous.is_none(){state.active=None;}
                }
                let _=self.save_state();
            }
            self.event(&app,"installed","保存进度后重新打开小屋即可启用资源",100);
            return
        }
        if !["check","auto"].contains(&action) {return}
        if self.busy.swap(true,Ordering::SeqCst) {return}
        let automatic=action=="auto";
        self.event(&app,"checking","正在检查变更资源",0);
        let result=self.download(&app,url,automatic);
        self.busy.store(false,Ordering::SeqCst);
        match result {
            Ok(changed)=>self.event(&app,if changed{"available"}else{"current"},if changed{"资源已在后台准备好，下次启动自动启用"}else{"当前资源已是最新版本"},100),
            Err(error)=>self.event(&app,"error",&format!("资源同步暂未完成：{}",error),0),
        }
    }
    fn download(&self,app:&tauri::AppHandle,url:Option<String>,automatic:bool)->Result<bool,String> {
        let address=url.unwrap_or_else(||format!("{}/android-update/update.json",env!("LOVEHOUSE_CONTENT_SERVER").trim_end_matches('/')));
        let url=reqwest::Url::parse(&address).map_err(|e|e.to_string())?;
        if url.scheme()!="https" || !url.username().is_empty() || url.password().is_some(){return Err("需要 HTTPS 更新地址".into())}
        let client=reqwest::blocking::Client::builder().timeout(Duration::from_secs(120)).redirect(reqwest::redirect::Policy::none()).build().map_err(|e|e.to_string())?;
        let response=client.get(url.clone()).send().and_then(|r|r.error_for_status()).map_err(|e|e.to_string())?;
        let mut signed=Vec::new();response.take(3_000_001).read_to_end(&mut signed).map_err(|e|e.to_string())?;
        let next=manifest(&signed)?;
        {
            let state=self.versions.lock().map_err(|_|"资源状态不可用")?;
            if next.built_at<=env!("LOVEHOUSE_BUILD_EPOCH").parse().unwrap_or(u64::MAX)
                || next.version<=state.active.unwrap_or(0) || state.pending==Some(next.version)
                || (automatic&&state.failed==Some(next.version)){return Ok(false)}
        }
        fs::create_dir_all(&self.root).map_err(|e|e.to_string())?;
        let staging=tempfile::Builder::new().prefix("staging-").tempdir_in(&self.root).map_err(|e|e.to_string())?;
        for (index,(name,spec)) in next.files.iter().enumerate() {
            let destination=staging.path().join(name);
            let prior=self.active.as_ref().and_then(|(root,_)|fs::read(root.join(name)).ok())
                .filter(|bytes|bytes.len() as u64==spec.bytes&&digest(bytes)==spec.sha256);
            let bundled=if prior.is_none(){app.asset_resolver().get(name.clone()).map(|a|a.bytes).filter(|bytes|bytes.len() as u64==spec.bytes&&digest(bytes)==spec.sha256)}else{None};
            let bytes=if let Some(bytes)=prior.or(bundled){bytes}else{
                let blob=url.join(&format!("blobs/{}",spec.sha256)).map_err(|e|e.to_string())?;
                let response=client.get(blob).send().and_then(|r|r.error_for_status()).map_err(|e|e.to_string())?;
                let mut bytes=Vec::new();response.take(spec.bytes+1).read_to_end(&mut bytes).map_err(|e|e.to_string())?;
                if bytes.len() as u64!=spec.bytes || digest(&bytes)!=spec.sha256{return Err(format!("资源校验失败：{}",name))}
                bytes
            };
            fs::create_dir_all(destination.parent().unwrap()).map_err(|e|e.to_string())?;
            fs::write(destination,bytes).map_err(|e|e.to_string())?;
            self.event(app,"downloading","正在准备变更资源",(index as u64+1)*100/next.files.len() as u64);
        }
        fs::write(staging.path().join("update.json"),signed).map_err(|e|e.to_string())?;
        let destination=self.root.join(next.version.to_string());
        if destination.exists(){fs::remove_dir_all(&destination).map_err(|e|e.to_string())?;}
        fs::rename(staging.path(),destination).map_err(|e|e.to_string())?;
        self.versions.lock().map_err(|_|"资源状态不可用")?.pending=Some(next.version);
        self.save_state()?;
        Ok(true)
    }
    pub fn resource(&self,path:&str)->Option<Vec<u8>>{
        let name=path.trim_start_matches('/');
        let name=if name.is_empty(){"index.html"}else{name};
        if !relative(name){return None}
        let (root,manifest)=self.active.as_ref()?;
        if !manifest.files.contains_key(name){return None}
        fs::read(root.join(name)).ok()
    }
}
