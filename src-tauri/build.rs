use std::path::PathBuf;
use std::process::Command as SysCommand;

fn main() {
    // macOS: build Swift sidecar (sck-recorder) for ScreenCaptureKit BEFORE tauri_build
    #[cfg(target_os = "macos")]
    {
        // Paths
        let crate_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
        let swift_src = PathBuf::from(&crate_dir).join("macos/SCKRecorder.swift");
        let bin_dir = PathBuf::from(&crate_dir).join("bin");

        // Target triple expected by Tauri for externalBin
        let target_triple = std::env::var("TAURI_ENV_TARGET_TRIPLE").unwrap_or_else(|_| {
            // fallback to rustc -vV
            let out = SysCommand::new("rustc")
                .arg("-vV")
                .output()
                .expect("rustc -vV");
            let s = String::from_utf8_lossy(&out.stdout);
            s.lines()
                .find_map(|l| l.strip_prefix("host: ").map(|v| v.to_string()))
                .unwrap_or_else(|| String::from("aarch64-apple-darwin"))
        });

        let out_bin = bin_dir.join(format!("sck-recorder-{}", target_triple));

        // Rebuild if source changes
        println!("cargo:rerun-if-changed={}", swift_src.display());

        // Ensure bin dir exists
        std::fs::create_dir_all(&bin_dir).expect("create bin dir");

        // Build swift executable
        std::env::set_var("MACOSX_DEPLOYMENT_TARGET", "12.3");
        let status = SysCommand::new("swiftc")
            .args([
                "-O",
                "-target",
                "arm64-apple-macosx12.3",
                "-framework",
                "ScreenCaptureKit",
                "-framework",
                "AVFoundation",
                "-framework",
                "CoreMedia",
                "-framework",
                "CoreVideo",
                "-o",
                out_bin.to_str().unwrap(),
                swift_src.to_str().unwrap(),
            ])
            .status()
            .expect("failed to invoke swiftc");

        if !status.success() {
            panic!("swiftc failed to build sck-recorder");
        }
    }

    // Build Tauri generated code (reads externalBin which now exists)
    tauri_build::build();
}
