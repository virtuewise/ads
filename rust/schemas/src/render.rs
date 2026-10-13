//! Render Input Contract
//!
//! Drives the Remotion renderer (`apps/renderer`).
//! This is the exact contract between the production pipeline and the renderer.

use serde::{Deserialize, Serialize};
use schemars::JsonSchema;

/// Brand tokens for rendering
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct BrandTokens {
    pub wordmark: String,
    pub tagline: String,
    pub primary: String,
    pub secondary: String,
    pub accent: String,
    pub paper: String,
    pub ink: String,
}

/// Camera path enumeration
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum CameraPath {
    Turntable,
    Orbit,
    Dolly,
    Hero,
    Showcase,
    None,
}

/// Composition ID enumeration
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "PascalCase")]
pub enum CompositionId {
    PrintSyncSignatureFilm,
    PrintSyncProductLine,
    PrintSyncBrandFilm,
    PrintSyncLivingCity,
}

/// Time of day enumeration
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum TimeOfDay {
    Night,
    Dusk,
    Day,
}

/// City-specific inputs
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct CityInputs {
    pub seed: String,
    pub time_of_day: TimeOfDay,
    pub density: f32,
    pub route: bool,
}

/// Render item (print item to display)
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RenderItem {
    pub id: String,
    pub animation: String,
    pub phase: u32,
}

/// Timeline configuration
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Timeline {
    pub fps: u32,
    pub duration_in_frames: u32,
}

/// Output configuration
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RenderOutput {
    pub format: String,
    pub width: u32,
    pub height: u32,
}

/// Complete render inputs - the exact contract for the renderer
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RenderInputs {
    pub composition: CompositionId,
    pub brand: BrandTokens,
    pub items: Vec<String>,
    pub item_animations: Vec<RenderItem>,
    pub camera_path: CameraPath,
    pub city: Option<CityInputs>,
    pub timeline: Timeline,
    pub output: RenderOutput,
}

/// Validation helper
pub fn validate_render_inputs(inputs: &RenderInputs) -> Result<(), String> {
    if inputs.timeline.fps == 0 {
        return Err("fps must be > 0".into());
    }
    if inputs.timeline.duration_in_frames == 0 {
        return Err("duration_in_frames must be > 0".into());
    }
    if items_empty(&inputs.items) {
        return Err("items cannot be empty".into());
    }
    Ok(())
}

fn items_empty(items: &[String]) -> bool {
    items.is_empty()
}

impl Default for CityInputs {
    fn default() -> Self {
        Self {
            seed: "printsync-city-01".into(),
            time_of_day: TimeOfDay::Night,
            density: 1.0,
            route: true,
        }
    }
}

impl Default for BrandTokens {
    fn default() -> Self {
        Self {
            wordmark: "PRINTSYNC".into(),
            tagline: "Every surface, printed to spec.".into(),
            primary: "#C8001C".into(),
            secondary: "#373435".into(),
            accent: "#00A8E0".into(),
            paper: "#F5F1EA".into(),
            ink: "#141414".into(),
        }
    }
}

impl Default for Timeline {
    fn default() -> Self {
        Self {
            fps: 30,
            duration_in_frames: 450,
        }
    }
}

impl Default for RenderOutput {
    fn default() -> Self {
        Self {
            format: "mp4".into(),
            width: 1920,
            height: 1080,
        }
    }
}