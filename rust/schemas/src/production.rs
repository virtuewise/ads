//! Production Plan Types
//!
//! Complete production pipeline output types.

use serde::{Deserialize, Serialize};
use schemars::JsonSchema;
use uuid::Uuid;
use crate::brief::{VisualGrammar, StoryBeat};

/// Unique identifier for a production plan
pub type PlanId = Uuid;

/// Script step - time-boxed piece of the script
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScriptStep {
    pub start: f32,          // seconds
    pub end: f32,            // seconds
    pub visual: String,
    pub dialogue: Option<String>,
    pub sfx: Option<String>,
    pub text: Option<String>,
    pub camera: Option<String>,
}

/// Complete script
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Script {
    pub steps: Vec<ScriptStep>,
}

/// Storyboard (higher-level shot representation)
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Storyboard {
    pub shots: Vec<Shot>,
}

/// Camera specification
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct CameraSpec {
    #[serde(rename = "type")]
    pub camera_type: String,    // e.g., "TRACKING", "STATIC", "ESTABLISHING", "HERO"
    pub lens: Option<String>,   // e.g., "35mm", "85mm"
    pub movement: Option<String>,
}

/// Shot definition - atomic production unit
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Shot {
    pub id: String,
    pub start: f32,             // seconds
    pub duration: f32,          // seconds
    pub purpose: String,
    pub camera: CameraSpec,
    pub subject: Option<String>,
    pub environment: Option<String>,
    pub action: Option<String>,
    pub lighting: Option<String>,
    pub typography: Option<String>,
    pub vfx: Option<String>,
    pub transition: Option<String>,
    pub audio: Option<Vec<String>>,
}

/// Asset requirement
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct AssetRequirement {
    #[serde(rename = "type")]
    pub asset_type: String,     // "image", "video", "audio", "model", "typography", "vfx_preset", "voiceover", "music", "sfx", "brand_mark", "brand_guidelines", "color_palette"
    pub url: String,
    pub description: Option<String>,
}

/// Typography plan
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct TypographyPlan {
    pub style: String,
    pub animations: Vec<String>,
}

/// Motion plan
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct MotionPlan {
    pub tracks: Vec<String>,
    pub templates: Vec<String>,
}

/// VFX plan
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct VFXPlan {
    pub effects: Vec<String>,
}

/// Audio plan
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct AudioPlan {
    pub clips: Vec<String>,
}

/// Edit plan
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct EditPlan {
    pub cuts: Vec<String>,
}

/// QA plan
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct QAPlan {
    pub checks: Vec<String>,
}

/// Output specification
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct OutputSpec {
    pub format: String,
    pub resolution: String,
    pub bitrate: Option<String>,
}

/// Scene graph node
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct SceneNode {
    pub id: String,
    pub node_type: String,
    pub data: serde_json::Value,
}

/// Scene graph edge
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct SceneEdge {
    pub from: String,
    pub to: String,
    pub relation: String,
    pub weight: Option<f32>,
}

/// Scene graph
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct SceneGraph {
    pub nodes: Vec<SceneNode>,
    pub edges: Vec<SceneEdge>,
}

/// Production status
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ProductionStatus {
    Planning,
    Complete,
}

/// Top-level production plan
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProductionPlan {
    pub id: PlanId,
    pub brief: crate::brief::CreativeBrief,
    pub script: Script,
    pub storyboard: Storyboard,
    pub shots: Vec<Shot>,
    pub assets: Vec<AssetRequirement>,
    pub typography: TypographyPlan,
    pub motion: MotionPlan,
    pub vfx: VFXPlan,
    pub audio: AudioPlan,
    pub edit: EditPlan,
    pub qa: QAPlan,
    pub output: OutputSpec,
    pub visual_grammar: VisualGrammar,
    pub scene_graph: SceneGraph,
    pub production_status: ProductionStatus,
}

impl ProductionPlan {
    pub fn validate(&self) -> bool {
        self.production_status == ProductionStatus::Complete
            && !self.shots.is_empty()
            && !self.script.steps.is_empty()
    }
}