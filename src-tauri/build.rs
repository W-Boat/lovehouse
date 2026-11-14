fn main() {
    println!("cargo:rerun-if-env-changed=GITHUB_SHA");
    println!("cargo:rerun-if-env-changed=LOVEHOUSE_CONTENT_SERVER");
    for name in ["LOVEHOUSE_THIN_BASE", "LOVEHOUSE_NATIVE_REVISION", "LOVEHOUSE_BUNDLED_RESOURCE_VERSION"] {
        println!("cargo:rerun-if-env-changed={}", name);
        println!("cargo:rustc-env={}={}", name, std::env::var(name).unwrap_or_default());
    }
    let server = std::env::var("LOVEHOUSE_CONTENT_SERVER").ok().filter(|s| !s.is_empty())
        .unwrap_or_else(|| "https://server.080726.xyz/lovehouse/".into());
    println!("cargo:rustc-env=LOVEHOUSE_CONTENT_SERVER={}", server);
    tauri_build::build()
}
