//! Creative Brief & Subject Analysis Types
//!
//! Core input types for the production pipeline.

use serde::{Deserialize, Serialize};
use schemars::JsonSchema;
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Unique identifier for a creative brief
pub type BriefId = Uuid;

/// A creative brief - the primary input to the production pipeline
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreativeBrief {
    /// Unique identifier (auto-generated if not provided)
    pub id: Option<BriefId>,
    /// Human-readable title
    pub title: String,
    /// Duration in seconds
    pub duration: f32,
    /// Creative mode (e.g., "EXPLAINER", "CORPORATE", "DETECTIVE", "TYPOGRAPHIC_FILM")
    pub mode: String,
    /// Service being advertised
    pub service: String,
    /// Business objective
    pub objective: String,
    /// Voice mode (e.g., "NARRATION", "DIALOGUE", "TYPOGRAPHY_ONLY", "MUSIC_ONLY", "HYBRID")
    pub voice: String,
    /// High-level scene identifiers
    pub scenes: Vec<String>,
    /// Optional seed for deterministic generation
    pub seed: Option<String>,
    /// Creation timestamp
    #[serde(default = "Utc::now")]
    pub created_at: DateTime<Utc>,
}

/// Entity extracted from brief text
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Entity {
    pub name: String,
    #[serde(rename = "type")]
    pub entity_type: EntityType,
    pub confidence: f32,
    pub mentions: u32,
}

/// Entity classification
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EntityType {
    Brand,
    Product,
    Service,
    Concept,
    Audience,
    Competitor,
    Metric,
}

/// Goal extracted from objective
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Goal {
    pub description: String,
    #[serde(rename = "type")]
    pub goal_type: GoalType,
    pub priority: u8, // 1-10
}

/// Goal classification
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum GoalType {
    Awareness,
    Conversion,
    Education,
    Engagement,
    Loyalty,
}

/// Subject analysis output
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct SubjectInfo {
    pub key_entities: Vec<Entity>,
    pub primary_goal: Goal,
    pub secondary_goals: Vec<Goal>,
    pub target_audience: Vec<String>,
    pub key_messages: Vec<String>,
    pub tone: Tone,
    pub territory: Territory,
}

/// Overall tone classification
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Tone {
    Cinematic,
    Technical,
    Playful,
    Dramatic,
    Minimal,
}

/// Creative territory
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Territory {
    Transformation,
    Scale,
    HumanImpact,
    Precision,
    Play,
}

/// Story beat within a narrative outline
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct StoryBeat {
    pub id: String,
    pub label: String,
    pub purpose: BeatPurpose,
    pub duration_ratio: f32,
    pub entities: Vec<Entity>,
    pub visual_hint: String,
}

/// Narrative beat purpose
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum BeatPurpose {
    Hook,
    Problem,
    Solution,
    Proof,
    Benefit,
    Cta,
    Brand,
    Education,
}

/// Narrative structure type
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum NarrativeStructure {
    ThreeAct,
    ProblemSolution,
    BeforeAfter,
    Detective,
    Educational,
    HeroJourney,
}

/// Story outline with structured beats
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct StoryOutline {
    pub beats: Vec<StoryBeat>,
    pub structure: NarrativeStructure,
    pub total_beats: u32,
    /// Legacy field for backward compatibility
    pub outline: Option<Vec<String>>,
}

/// Visual grammar definition
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct VisualGrammar {
    pub name: String,
    pub description: String,
    pub sequence: Vec<String>,
}