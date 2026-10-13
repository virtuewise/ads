//! xtask - Custom build tasks for Virtue Studio
//!
//! Run with: `cargo xtask <COMMAND>`
//! Or via cargo-make: `cargo make <TASK>`

use clap::{Parser, Subcommand};
use std::path::PathBuf;
use tracing_subscriber::{EnvFilter, fmt};

mod biome;
mod native_build;
mod schema_gen;

#[derive(Parser)]
#[command(name = "xtask", version, about = "Virtue Studio build tasks")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Run Biome lint + format check
    BiomeCheck {
        /// Fix issues automatically
        #[arg(short, long)]
        fix: bool,
        /// Path to check (default: repo root)
        #[arg(short, long)]
        path: Option<PathBuf>,
    },

    /// Generate Zod schemas from Rust types
    GenerateSchemas {
        /// Output directory (default: packages/common/src)
        #[arg(short, long, default_value = "../../packages/common/src")]
        output: PathBuf,
    },

    /// Build native module (@printsync/core-native)
    BuildNative {
        /// Build in release mode
        #[arg(short, long)]
        release: bool,
        /// Target platform (default: current)
        #[arg(long)]
        target: Option<String>,
    },

    /// Run full CI pipeline (lint + test + build)
    Ci {
        /// Skip native build
        #[arg(long)]
        no_native: bool,
    },

    /// Install git hooks via lefthook
    InstallHooks,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("xtask=info".parse()?))
        .init();

    let cli = Cli::parse();

    match cli.command {
        Command::BiomeCheck { fix, path } => biome::run(fix, path).await,
        Command::GenerateSchemas { output } => schema_gen::run(output).await,
        Command::BuildNative { release, target } => native_build::run(release, target).await,
        Command::Ci { no_native } => run_ci(no_native).await,
        Command::InstallHooks => install_hooks().await,
    }
}

async fn run_ci(no_native: bool) -> anyhow::Result<()> {
    println!("🔍 Running CI pipeline...");

    // 1. Biome check
    biome::run(false, None).await?;
    println!("✅ Biome check passed");

    // 2. Schema generation
    schema_gen::run("../../packages/common/src".into()).await?;
    println!("✅ Schemas generated");

    // 3. Native build (optional)
    if !no_native {
        native_build::run(true, None).await?;
        println!("✅ Native module built");
    }

    // 4. TypeScript build (delegates to pnpm)
    let status = tokio::process::Command::new("pnpm")
        .args(["build"])
        .status()
        .await?;
    anyhow::ensure!(status.success(), "pnpm build failed");
    println!("✅ TypeScript build passed");

    // 5. Tests
    let status = tokio::process::Command::new("cargo")
        .args(["nextest", "run", "--workspace"])
        .status()
        .await?;
    anyhow::ensure!(status.success(), "cargo nextest failed");
    println!("✅ Rust tests passed");

    let status = tokio::process::Command::new("pnpm")
        .args(["test"])
        .status()
        .await?;
    anyhow::ensure!(status.success(), "pnpm test failed");
    println!("✅ TypeScript tests passed");

    println!("🎉 All CI checks passed!");
    Ok(())
}

async fn install_hooks() -> anyhow::Result<()> {
    println!("🔧 Installing lefthook...");

    // Check if lefthook is installed
    let status = tokio::process::Command::new("lefthook")
        .args(["version"])
        .status()
        .await?;

    if !status.success() {
        println!("📦 Installing lefthook via cargo...");
        let status = tokio::process::Command::new("cargo")
            .args(["install", "lefthook"])
            .status()
            .await?;
        anyhow::ensure!(status.success(), "Failed to install lefthook");
    }

    // Install hooks
    let status = tokio::process::Command::new("lefthook")
        .args(["install"])
        .status()
        .await?;
    anyhow::ensure!(status.success(), "lefthook install failed");

    println!("✅ Git hooks installed");
    Ok(())
}