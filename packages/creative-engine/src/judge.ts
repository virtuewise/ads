/**
 * Creative Judge
 * Scores every concept against PrintSync's creative standards.
 * Rejects weak concepts. Approves only the strongest.
 */

import type {
  Concept,
  CreativeHistoryEntry,
  CreativeScore,
  CreativeScoreThresholds,
} from '@printsync/shared';
import { DEFAULT_THRESHOLDS, getScoreStatus } from '@printsync/shared';
import { checkAntiGeneric } from './anti-generic.js';

export class CreativeJudge {
  private thresholds: CreativeScoreThresholds;
  private history: CreativeHistoryEntry[];

  constructor(
    history: CreativeHistoryEntry[] = [],
    thresholds: CreativeScoreThresholds = DEFAULT_THRESHOLDS,
  ) {
    this.history = history;
    this.thresholds = thresholds;
  }

  /**
   * Score a single concept.
   */
  scoreConcept(concept: Concept): CreativeScore {
    const antiGeneric = checkAntiGeneric(concept, this.history);

    const brand_fit = this.scoreBrandFit(concept);
    const originality = this.scoreOriginality(concept);
    const commercial_value = this.scoreCommercialValue(concept);
    const visual_potential = this.scoreVisualPotential(concept);
    const emotional_impact = this.scoreEmotionalImpact(concept);
    const memorability = this.scoreMemorability(concept);
    const social_stop_power = this.scoreSocialStopPower(concept);
    const production_quality = this.scoreProductionQuality(concept);
    const service_relevance = this.scoreServiceRelevance(concept);
    const non_generic_quality = this.scoreNonGeneric(antiGeneric);

    // Each dimension is scored 0–10. Average them, then scale to the shared
    // 0–100 rubric so `getScoreStatus` and every consumer (the band thresholds
    // 70/80/90, the CLI's `${total}/100`) see the scale the thresholds are
    // defined in.
    const total = Math.round(
      ((brand_fit +
        originality +
        commercial_value +
        visual_potential +
        emotional_impact +
        memorability +
        social_stop_power +
        production_quality +
        service_relevance +
        non_generic_quality) /
        10) *
        10,
    );

    const status = getScoreStatus(total, this.thresholds);
    const feedback = this.generateFeedback(concept, {
      brand_fit,
      originality,
      commercial_value,
      visual_potential,
      emotional_impact,
      memorability,
      social_stop_power,
      production_quality,
      service_relevance,
      non_generic_quality,
    });

    return {
      brand_fit,
      originality,
      commercial_value,
      visual_potential,
      emotional_impact,
      memorability,
      social_stop_power,
      production_quality,
      service_relevance,
      non_generic_quality,
      total,
      status,
      feedback,
    };
  }

  /**
   * Score multiple concepts and return them sorted by total score.
   */
  scoreConcepts(concepts: Concept[]): Concept[] {
    return concepts
      .map((c) => ({
        ...c,
        score: this.scoreConcept(c),
      }))
      .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0));
  }

  /**
   * Determine if a concept should be approved, reworked, or rejected.
   */
  evaluateConcept(concept: Concept): {
    approved: boolean;
    score: CreativeScore;
    action: 'APPROVE' | 'REWORK' | 'REJECT';
    reason: string;
  } {
    const score = this.scoreConcept(concept);

    if (score.status === 'SIGNATURE') {
      return {
        approved: true,
        score,
        action: 'APPROVE',
        reason: 'SIGNATURE CONCEPT — Exceptional creative quality',
      };
    }
    if (score.status === 'APPROVE') {
      return {
        approved: true,
        score,
        action: 'APPROVE',
        reason: 'APPROVED — Strong creative concept',
      };
    }
    if (score.status === 'REWORK') {
      return {
        approved: false,
        score,
        action: 'REWORK',
        reason: 'NEEDS REWORK — Good foundation but requires improvement',
      };
    }
    return {
      approved: false,
      score,
      action: 'REJECT',
      reason: 'REJECTED — Does not meet PrintSync creative standards',
    };
  }

  // ─── Scoring Dimensions ───────────────────────────────────────────────────

  private scoreBrandFit(concept: Concept): number {
    let score = 7;

    // Check if concept uses PrintSync brand elements
    if (concept.territory === 'PRECISION' || concept.territory === 'TRANSFORMATION') score += 1;
    if (concept.mood === 'technical' || concept.mood === 'minimal') score += 0.5;
    if (concept.visual_style === 'typography') score += 0.5;

    // Penalize generic patterns
    if (concept.title.toLowerCase().includes('quality')) score -= 2;
    if (concept.title.toLowerCase().includes('solution')) score -= 1;

    return Math.min(10, Math.max(1, Math.round(score)));
  }

  private scoreOriginality(concept: Concept): number {
    let score = 6;

    // Reward unique creative modes
    if (concept.creative_mode === 'DETECTIVE_AD') score += 2;
    if (concept.creative_mode === 'VFX_EXPERIMENT') score += 1.5;
    if (concept.creative_mode === 'TYPOGRAPHIC_FILM') score += 1;

    // Reward unusual territories
    if (concept.territory === 'PLAY') score += 1;
    if (concept.territory === 'SCALE') score += 0.5;

    // Check for repetition
    const recentSimilar = this.history.filter(
      (h) => h.creative_mode === concept.creative_mode && h.territory === concept.territory,
    ).length;
    score -= recentSimilar * 1.5;

    return Math.min(10, Math.max(1, Math.round(score)));
  }

  private scoreCommercialValue(concept: Concept): number {
    let score = 7;

    // Reward clear CTAs
    if (concept.cta.length > 0 && concept.cta.length < 30) score += 1;

    // Reward service relevance
    if (concept.story_summary.toLowerCase().includes('print')) score += 0.5;
    if (concept.story_summary.toLowerCase().includes('brand')) score += 0.5;

    // Penalize vague concepts
    if (concept.logline.toLowerCase().includes('solution')) score -= 1;
    if (concept.logline.toLowerCase().includes('quality')) score -= 1;

    return Math.min(10, Math.max(1, Math.round(score)));
  }

  private scoreVisualPotential(concept: Concept): number {
    let score = 6;

    // Reward strong visual styles
    if (concept.visual_style === 'vfx') score += 2;
    if (concept.visual_style === 'typography') score += 1.5;
    if (concept.visual_style === 'mixed') score += 1;

    // Reward strong key visuals
    if (concept.key_visual.length > 50) score += 1;
    if (concept.key_visual.toLowerCase().includes('transform')) score += 0.5;
    if (concept.key_visual.toLowerCase().includes('scale')) score += 0.5;

    return Math.min(10, Math.max(1, Math.round(score)));
  }

  private scoreEmotionalImpact(concept: Concept): number {
    let score = 6;

    // Reward emotional moods
    if (concept.mood === 'dramatic') score += 1.5;
    if (concept.mood === 'cinematic') score += 1;
    if (concept.mood === 'playful') score += 0.5;

    // Reward narrative structures
    if (concept.narrative_structure === 'MYSTERY_CLUE_INVESTIGATION_REVEAL_PRODUCT_CTA') score += 1;
    if (concept.narrative_structure === 'CHAOS_PRECISION_CONTROL_RESULT') score += 0.5;

    return Math.min(10, Math.max(1, Math.round(score)));
  }

  private scoreMemorability(concept: Concept): number {
    let score = 6;

    // Reward short, punchy titles
    if (concept.title.length < 30) score += 1.5;
    if (concept.title.length < 20) score += 0.5;

    // Reward alliteration and wordplay
    const [firstWord, secondWord] = concept.title.split(' ');
    if (firstWord && secondWord && firstWord[0] === secondWord[0]) score += 1;

    // Reward unique concepts
    if (concept.creative_mode === 'DETECTIVE_AD') score += 1;
    if (concept.creative_mode === 'HUMOR_AD') score += 0.5;

    return Math.min(10, Math.max(1, Math.round(score)));
  }

  private scoreSocialStopPower(concept: Concept): number {
    let score = 6;

    // Reward vertical formats
    if (concept.formats.includes('9:16')) score += 1;
    if (concept.formats.includes('1:1')) score += 0.5;

    // Reward short durations
    if (concept.target_duration_seconds <= 15) score += 1.5;
    if (concept.target_duration_seconds <= 30) score += 0.5;

    // Reward visual-first concepts
    if (concept.voice_mode === 'TYPOGRAPHY_ONLY' || concept.voice_mode === 'MUSIC_ONLY') score += 1;

    return Math.min(10, Math.max(1, Math.round(score)));
  }

  private scoreProductionQuality(concept: Concept): number {
    let score = 7;

    // Reward feasible production
    if (concept.creative_mode === 'TYPOGRAPHIC_FILM') score += 1;
    if (concept.creative_mode === 'TYPOGRAPHY_ONLY') score += 1;

    // Penalize overly complex concepts
    if (concept.creative_mode === '3D_PRODUCT_FILM') score -= 0.5;
    if (concept.creative_mode === 'VFX_EXPERIMENT') score -= 0.5;

    return Math.min(10, Math.max(1, Math.round(score)));
  }

  private scoreServiceRelevance(concept: Concept): number {
    let score = 7;

    // Check if concept mentions specific services
    const text = `${concept.title} ${concept.logline} ${concept.story_summary}`.toLowerCase();
    const services = ['print', 'sign', 'brand', 'label', 'packag', 'banner', 'poster', 'display'];
    const matches = services.filter((s) => text.includes(s)).length;
    score += Math.min(3, matches);

    return Math.min(10, Math.max(1, Math.round(score)));
  }

  private scoreNonGeneric(antiGeneric: { passed: boolean; issues: string[] }): number {
    if (antiGeneric.passed) return 10;
    return Math.max(0, 10 - antiGeneric.issues.length * 2);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private generateFeedback(
    _concept: Concept,
    scores: Omit<CreativeScore, 'total' | 'status' | 'feedback'>,
  ): string[] {
    const feedback: string[] = [];

    if (scores.brand_fit < 7) feedback.push('Strengthen PrintSync brand connection');
    if (scores.originality < 7) feedback.push('Increase originality — avoid familiar patterns');
    if (scores.commercial_value < 7) feedback.push('Clarify commercial value and CTA');
    if (scores.visual_potential < 7) feedback.push('Develop stronger visual concept');
    if (scores.emotional_impact < 7) feedback.push('Increase emotional resonance');
    if (scores.memorability < 7) feedback.push('Make the concept more memorable');
    if (scores.social_stop_power < 7) feedback.push('Optimize for social engagement');
    if (scores.production_quality < 7) feedback.push('Consider production feasibility');
    if (scores.service_relevance < 7) feedback.push('Strengthen service connection');
    if (scores.non_generic_quality < 7) feedback.push('Reduce generic indicators');

    if (feedback.length === 0) {
      feedback.push('Strong concept across all dimensions');
    }

    return feedback;
  }
}
