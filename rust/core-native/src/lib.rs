//! Virtue Studio Native Hot Paths
//!
//! High-performance implementations for compute-intensive operations:
//! - FNV-1a hashing (deterministic procedural generation)
//! - Camera math (frameDistance, boulevardPose, subjectPose)
//! - Audio analysis (analyzeFrequencyBands)
//! - City layout helpers (grid, spacing, clearance)

use napi_derive::napi;

/// FNV-1a 64-bit hash - deterministic procedural generation seed
#[napi]
pub fn fnv1a_64(data: &str) -> u64 {
    const FNV_OFFSET_BASIS: u64 = 0xcbf29ce484222325;
    const FNV_PRIME: u64 = 0x100000001b3;
    let mut hash = FNV_OFFSET_BASIS;
    for byte in data.as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(FNV_PRIME);
    }
    hash
}

/// FNV-1a 32-bit hash (for smaller ranges)
#[napi]
pub fn fnv1a_32(data: &str) -> u32 {
    const FNV_OFFSET_BASIS: u32 = 0x811c9dc5;
    const FNV_PRIME: u32 = 0x01000193;
    let mut hash = FNV_OFFSET_BASIS;
    for byte in data.as_bytes() {
        hash ^= *byte as u32;
        hash = hash.wrapping_mul(FNV_PRIME);
    }
    hash
}

/// Deterministic seeded random (mulberry32) - frame-addressable
#[napi]
pub fn mulberry32(seed: u32) -> impl FnMut() -> f32 {
    let mut state = seed;
    move || {
        state = state.wrapping_add(0x6D2B79F5);
        let mut z = state;
        z = (z ^ (z >> 15)).wrapping_mul(0x85EBCA6B);
        z = (z ^ (z >> 13)).wrapping_mul(0xC2B2AE35);
        z = z ^ (z >> 16);
        (z as f32) / 4_294_967_296.0
    }
}

/// Frame distance from vertical FOV and visible width
/// `visibleWidth = 2 * distance * tan(fov/2) * aspect`
/// `distance = visibleWidth / (2 * tan(fov/2) * aspect)`
#[napi]
pub fn frame_distance(visible_width: f32, fov_deg: f32, aspect: f32) -> f32 {
    let half_fov_rad = (fov_deg * std::f32::consts::PI / 180.0) * 0.5;
    visible_width / (2.0 * half_fov_rad.tan() * aspect)
}

/// Boulevard camera pose (travelling pass)
#[napi]
pub struct BoulevardPose {
    pub position: Vec3,
    pub look_at: Vec3,
}

#[napi]
pub fn boulevard_pose(t: f32, extent: f32, rise: f32) -> BoulevardPose {
    // t in [0, 1], extent = city half-length
    // Left lane divider at x = -5.6, y = 1.72, z = e*0.62 -> -e*0.12
    let x = -5.6;
    let y = 1.72 + rise * 12.28; // 1.72 -> 14.0
    let z = extent * (0.62 - 0.74 * t); // 0.62*e -> -0.12*e
    let yaw = (1.0 - rise) * 8.5_f32.to_radians();
    let look_x = x - yaw;
    let look_y = 1.72 + rise * 12.28;
    let look_z = z - 42.0;

    BoulevardPose {
        position: Vec3 { x, y, z },
        look_at: Vec3 { x: look_x, y: look_y, z: look_z },
    }
}

/// Subject pose (square-on to face with push-in)
#[napi]
pub struct SubjectPose {
    pub position: Vec3,
    pub look_at: Vec3,
}

#[napi]
pub fn subject_pose(
    face_center: Vec3,
    normal: Vec3,
    tangent: Vec3,
    distance: f32,
    slide: f32,
    lift: f32,
    aim: f32,
    height: f32,
) -> SubjectPose {
    let up = Vec3 { x: 0.0, y: 1.0, z: 0.0 };
    let position = Vec3 {
        x: face_center.x + normal.x * distance + tangent.x * slide + up.x * lift,
        y: face_center.y + normal.y * distance + tangent.y * slide + up.y * lift,
        z: face_center.z + normal.z * distance + tangent.z * slide + up.z * lift,
    };
    let look_at = Vec3 {
        x: face_center.x + up.x * (aim * height),
        y: face_center.y + up.y * (aim * height),
        z: face_center.z + up.z * (aim * height),
    };
    SubjectPose { position, look_at }
}

/// 3D vector for napi
#[napi(object)]
pub struct Vec3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

/// Audio frequency band analysis (zero-copy)
#[napi]
pub fn analyze_frequency_bands(spectrum: &[f32], bands: u32) -> Vec<f32> {
    if bands == 0 || spectrum.is_empty() {
        return Vec::new();
    }

    let band_size = spectrum.len() as f32 / bands as f32;
    let mut result = Vec::with_capacity(bands as usize);

    for b in 0..bands {
        let start = (b as f32 * band_size).floor() as usize;
        let end = ((b as f32 + 1.0) * band_size).ceil() as usize;
        let end = end.min(spectrum.len());

        if start >= end {
            result.push(0.0);
            continue;
        }

        let sum: f32 = spectrum[start..end].iter().sum();
        let count = (end - start) as f32;
        result.push(if count > 0.0 { sum / count } else { 0.0 });
    }
    result
}

/// Kerb-side clearance (edge-based, not center-based)
#[napi]
pub fn kerbside_clearance(
    subject_z: f32,
    subject_half_length: f32,
    parked_vehicles_z: Vec<f32>,
    parked_half_lengths: Vec<f32>,
) -> f32 {
    let mut min_clearance = f32::INFINITY;
    for (pz, phl) in parked_vehicles_z.into_iter().zip(parked_half_lengths) {
        let clearance = (subject_z - pz).abs() - subject_half_length - phl;
        if clearance < min_clearance {
            min_clearance = clearance;
        }
    }
    if min_clearance == f32::INFINITY { 100.0 } else { min_clearance }
}

/// Lift wall panel above shopfront
#[napi]
pub fn lift_panel_above_shop(panel_bottom: f32, shop_height: f32, panel_height: f32, gap: f32) -> f32 {
    let new_center = shop_height + gap + panel_height * 0.5;
    new_center - panel_bottom
}

/// City grid layout helpers
#[napi]
pub fn city_grid_positions(
    extent: f32,
    slot_spacing: f32,
    building_width_range: (f32, f32),
) -> Vec<f32> {
    let mut positions = Vec::new();
    let mut z = -extent + slot_spacing * 0.5;
    while z < extent - slot_spacing * 0.5 {
        positions.push(z);
        z += slot_spacing;
    }
    positions
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fnv1a_deterministic() {
        assert_eq!(fnv1a_64("printsync"), fnv1a_64("printsync"));
        assert_ne!(fnv1a_64("a"), fnv1a_64("b"));
    }

    #[test]
    fn frame_distance_calc() {
        // fov=52°, aspect=16/9, visible_width=4.2m -> distance ≈ 2.42m
        let d = frame_distance(4.2, 52.0, 16.0 / 9.0);
        assert!((d - 2.42).abs() < 0.05);
    }

    #[test]
    fn boulevard_pose_range() {
        let p0 = boulevard_pose(0.0, 120.0, 0.0);
        let p1 = boulevard_pose(1.0, 120.0, 1.0);
        assert!((p0.position.z - 74.4).abs() < 0.1); // 120 * 0.62
        assert!((p1.position.z - (-14.4)).abs() < 0.1); // -120 * 0.12
    }

    #[test]
    fn analyze_frequency_bands_even() {
        let spectrum: Vec<f32> = (0..256).map(|i| i as f32 / 255.0).collect();
        let bands = analyze_frequency_bands(&spectrum, 4);
        assert_eq!(bands.len(), 4);
        assert!((bands[0] - 0.125).abs() < 0.01);
        assert!((bands[3] - 0.875).abs() < 0.01);
    }
}