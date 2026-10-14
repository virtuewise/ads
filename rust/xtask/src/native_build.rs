//! Native module build for `@printsync/core-native`.
//!
//! Mirrors `packages/core-native/scripts/build-native.js`: compiles the napi-rs
//! addon with Cargo and copies the platform artefact into the package `dist/`.
//! Degrades gracefully when Cargo is unavailable (the TypeScript fallbacks are
//! always usable).

use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tokio::process::Command;

const CARGO_MANIFEST: &str = "rust/core-native/Cargo.toml";

pub async fn run(release: bool, target: Option<String>) -> Result<()> {
    let profile = if release { "release" } else { "debug" };
    println!("🔨 Building @printsync/core-native ({profile})...");

    if !has_cargo().await {
        println!("⚠️  Cargo not found in PATH — skipping native build.");
        println!("   Native acceleration will use the TypeScript fallbacks.");
        return Ok(());
    }

    let mut cmd = Command::new("cargo");
    cmd.args(["build", "--manifest-path", CARGO_MANIFEST]);
    if release {
        cmd.arg("--release");
    }
    if let Some(triple) = target.as_deref() {
        cmd.args(["--target", triple]);
    }

    let status = cmd.status().await.context("failed to run cargo build")?;
    anyhow::ensure!(status.success(), "cargo build failed");

    copy_artifacts(release).await?;
    println!("✅ Native module built");
    Ok(())
}

async fn has_cargo() -> bool {
    Command::new("cargo")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map(|status| status.success())
        .unwrap_or(false)
}

async fn copy_artifacts(release: bool) -> Result<()> {
    let dist = PathBuf::from("packages/core-native/dist");
    tokio::fs::create_dir_all(&dist)
        .await
        .context("failed to create packages/core-native/dist")?;

    let profile = if release { "release" } else { "debug" };
    let target_dir = PathBuf::from(format!("rust/target/{profile}"));

    let artifacts: &[&str] = if cfg!(target_os = "windows") {
        &["core_native.dll", "core_native.dll.lib"]
    } else if cfg!(target_os = "macos") {
        &["libcore_native.dylib"]
    } else {
        &["libcore_native.so"]
    };

    for artifact in artifacts {
        let source = target_dir.join(artifact);
        if source.exists() {
            let destination = dist.join(Path::new(artifact));
            tokio::fs::copy(&source, &destination)
                .await
                .with_context(|| format!("failed to copy {artifact}"))?;
            println!("  📦 {artifact}");
        }
    }

    Ok(())
}
