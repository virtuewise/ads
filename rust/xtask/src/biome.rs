//! Biome linting & formatting integration

use anyhow::{Context, Result};
use std::path::PathBuf;
use tokio::process::Command;

const BIOME_CONFIG: &str = include_str!("../../../biome.json");

pub async fn run(fix: bool, path: Option<PathBuf>) -> Result<()> {
    let workspace_path = path.unwrap_or_else(|| PathBuf::from("."));
    let absolute_path = std::fs::canonicalize(&workspace_path)?;

    println!("🔍 Running Biome on: {}", absolute_path.display());

    // Write biome.json if it doesn't exist
    let config_path = absolute_path.join("biome.json");
    if !config_path.exists() {
        std::fs::write(&config_path, BIOME_CONFIG)
            .context("Failed to write biome.json")?;
        println!("📝 Created biome.json");
    }

    // Run biome via CLI (more reliable than programmatic API)
    let mut cmd = Command::new("biome");
    cmd.args(["check", "--config-path", "."]);

    if fix {
        cmd.args(["--write"]);
    }

    cmd.arg(&absolute_path);

    let status = cmd.status().await.context("Failed to run biome")?;

    if !status.success() {
        anyhow::bail!("Biome check failed (exit code: {:?})", status.code());
    }

    println!("✅ Biome check passed");
    Ok(())
}

pub async fn format(path: Option<PathBuf>) -> Result<()> {
    let workspace_path = path.unwrap_or_else(|| PathBuf::from("."));
    let absolute_path = std::fs::canonicalize(&workspace_path)?;

    let mut cmd = Command::new("biome");
    cmd.args(["format", "--write", "--config-path", ".", &absolute_path]);

    let status = cmd.status().await?;
    anyhow::ensure!(status.success(), "biome format failed");

    Ok(())
}