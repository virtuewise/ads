//! Virtue Studio Schema Definitions
//!
//! Single source of truth for all shared types.
//! Zod schemas are auto-generated via `schemars` and written to
//! `packages/common/src/generated/` by `cargo make generate-schemas`.

pub mod brief;
pub mod production;
pub mod render;

pub use brief::*;
pub use production::*;
pub use render::*;