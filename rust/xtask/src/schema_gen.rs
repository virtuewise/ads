//! Zod schema generation from Rust types

use anyhow::{Context, Result};
use schemars::schema_for;
use serde_json::to_string_pretty;
use std::path::{Path, PathBuf};
use tokio::fs;

pub async fn run(output_dir: PathBuf) -> Result<()> {
    println!("📝 Generating Zod schemas...");

    let output = output_dir.canonicalize().unwrap_or_else(|_| output_dir);
    fs::create_dir_all(&output).await.context("create output dir")?;

    // Generate all schemas
    let brief_schema = generate_brief_schema();
    let production_schema = generate_production_schema();
    let render_schema = generate_render_schema();

    // Write individual schema files
    write_schema(&output, "brief.zod.ts", &brief_schema).await?;
    write_schema(&output, "production.zod.ts", &production_schema).await?;
    write_schema(&output, "render.zod.ts", &render_schema).await?;

    // Write combined index
    write_index(&output).await?;

    println!("✅ Schemas generated to: {}", output.display());
    Ok(())
}

fn generate_brief_schema() -> String {
    let schema = schema_for!(schemas::brief::CreativeBrief);
    format_zod_schema(&schema, "CreativeBrief")
}

fn generate_production_schema() -> String {
    let schema = schema_for!(schemas::production::ProductionPlan);
    format_zod_schema(&schema, "ProductionPlan")
}

fn generate_render_schema() -> String {
    let schema = schema_for!(schemas::render::RenderInputs);
    format_zod_schema(&schema, "RenderInputs")
}

fn format_zod_schema(schema: &schemars::schema::RootSchema, name: &str) -> String {
    let json = to_string_pretty(schema).unwrap();
    format!(
        r#"/**
 * Auto-generated Zod schema for {}
 * DO NOT EDIT MANUALLY - run `cargo make generate-schemas`
 */"#,
        name
    ) + "\n" + &json + "\n"
}

async fn write_schema(dir: &Path, filename: &str, content: &str) -> Result<()> {
    let path = dir.join(filename);
    fs::write(&path, content).await.context(format!("write {}", filename))?;
    println!("  📄 {}", filename);
    Ok(())
}

async fn write_index(dir: &Path) -> Result<()> {
    let content = r#"/**
 * Auto-generated Zod schema exports
 * DO NOT EDIT MANUALLY - run `cargo make generate-schemas`
 */

export { CreativeBriefSchema } from './brief.zod';
export { ProductionPlanSchema } from './production.zod';
export { RenderInputsSchema } from './render.zod';

import type { z } from 'zod';
export type CreativeBrief = z.infer<typeof CreativeBriefSchema>;
export type ProductionPlan = z.infer<typeof ProductionPlanSchema>;
export type RenderInputs = z.infer<typeof RenderInputsSchema>;
"#;

    fs::write(dir.join("index.ts"), content).await?;
    println!("  📄 index.ts");
    Ok(())
}