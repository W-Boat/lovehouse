fn main() {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();
    println!("cargo:rustc-env=LOVEHOUSE_BUILD_EPOCH={}", now);
    let server = std::env::var("LOVEHOUSE_CONTENT_SERVER").ok().filter(|s| !s.is_empty())
        .unwrap_or_else(|| "https://server.080726.xyz/lovehouse/".into());
    println!("cargo:rustc-env=LOVEHOUSE_CONTENT_SERVER={}", server);
    tauri_build::build()
}
