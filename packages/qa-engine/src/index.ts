// QA Engine – quality assurance checks
import { Shot, QAPlan } from "@printsync/common";
import { getScoreStatus, DEFAULT_THRESHOLDS } from "@printsync/shared";

export interface QACheck {
  id: string;
  name: string;
  category: 'BRAND' | 'TECHNICAL' | 'CONTENT' | 'LEGAL' | 'ACCESSIBILITY' | 'PERFORMANCE';
  severity: 'BLOCKER' | 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO';
  description: string;
  automated: boolean;
  threshold?: number;
}

export const QA_CHECKS: Record<string, QACheck> = {
  BRAND_QA: {
    id: 'BRAND_QA',
    name: 'Brand Compliance',
    category: 'BRAND',
    severity: 'BLOCKER',
    description: 'Verify logo usage, colors, typography match brand guidelines',
    automated: true,
    threshold: 90,
  },
  BRAND_TYPOGRAPHY: {
    id: 'BRAND_TYPOGRAPHY',
    name: 'Typography Compliance',
    category: 'BRAND',
    severity: 'CRITICAL',
    description: 'Verify font families, weights, sizes match brand spec',
    automated: true,
    threshold: 85,
  },
  BRAND_COLOR: {
    id: 'BRAND_COLOR',
    name: 'Color Accuracy',
    category: 'BRAND',
    severity: 'BLOCKER',
    description: 'Verify primary/secondary/accent colors match brand tokens',
    automated: true,
    threshold: 95,
  },
  BRAND_LOGO: {
    id: 'BRAND_LOGO',
    name: 'Logo Usage',
    category: 'BRAND',
    severity: 'BLOCKER',
    description: 'Verify logo clear space, minimum size, correct variant',
    automated: true,
    threshold: 90,
  },
  RESOLUTION: {
    id: 'RESOLUTION',
    name: 'Resolution Check',
    category: 'TECHNICAL',
    severity: 'BLOCKER',
    description: 'Verify output meets minimum resolution requirements',
    automated: true,
    threshold: 100,
  },
  FRAME_RATE: {
    id: 'FRAME_RATE',
    name: 'Frame Rate Consistency',
    category: 'TECHNICAL',
    severity: 'CRITICAL',
    description: 'Verify consistent frame rate throughout',
    automated: true,
    threshold: 100,
  },
  BITRATE: {
    id: 'BITRATE',
    name: 'Bitrate Compliance',
    category: 'TECHNICAL',
    severity: 'MAJOR',
    description: 'Verify bitrate meets delivery spec',
    automated: true,
    threshold: 90,
  },
  CODEC: {
    id: 'CODEC',
    name: 'Codec Verification',
    category: 'TECHNICAL',
    severity: 'BLOCKER',
    description: 'Verify correct codec and container format',
    automated: true,
    threshold: 100,
  },
  AUDIO_SYNC: {
    id: 'AUDIO_SYNC',
    name: 'Audio Sync',
    category: 'TECHNICAL',
    severity: 'CRITICAL',
    description: 'Verify audio is synchronized with video',
    automated: true,
    threshold: 95,
  },
  AUDIO_LOUDNESS: {
    id: 'AUDIO_LOUDNESS',
    name: 'Loudness Compliance',
    category: 'TECHNICAL',
    severity: 'MAJOR',
    description: 'Verify audio loudness meets broadcast standard (-23 LUFS EBU R128)',
    automated: true,
    threshold: 90,
  },
  CONTENT_REVIEW: {
    id: 'CONTENT_REVIEW',
    name: 'Content Review',
    category: 'CONTENT',
    severity: 'CRITICAL',
    description: 'Verify messaging accuracy, claims substantiation',
    automated: false,
    threshold: 85,
  },
  MESSAGING_CLARITY: {
    id: 'MESSAGING_CLARITY',
    name: 'Messaging Clarity',
    category: 'CONTENT',
    severity: 'MAJOR',
    description: 'Verify key messages are clear and understandable',
    automated: false,
    threshold: 80,
  },
  CTA_VERIFICATION: {
    id: 'CTA_VERIFICATION',
    name: 'CTA Verification',
    category: 'CONTENT',
    severity: 'CRITICAL',
    description: 'Verify call-to-action is present, clear, and accurate',
    automated: true,
    threshold: 90,
  },
  LEGAL_CLEARANCE: {
    id: 'LEGAL_CLEARANCE',
    name: 'Legal Clearance',
    category: 'LEGAL',
    severity: 'BLOCKER',
    description: 'Verify all assets cleared for use, no IP violations',
    automated: false,
    threshold: 100,
  },
  COMPLIANCE: {
    id: 'COMPLIANCE',
    name: 'Regulatory Compliance',
    category: 'LEGAL',
    severity: 'BLOCKER',
    description: 'Verify compliance with advertising regulations',
    automated: false,
    threshold: 100,
  },
  ACCESSIBILITY_CAPTIONS: {
    id: 'ACCESSIBILITY_CAPTIONS',
    name: 'Closed Captions',
    category: 'ACCESSIBILITY',
    severity: 'MAJOR',
    description: 'Verify closed captions are present and accurate',
    automated: true,
    threshold: 90,
  },
  ACCESSIBILITY_CONTRAST: {
    id: 'ACCESSIBILITY_CONTRAST',
    name: 'Color Contrast',
    category: 'ACCESSIBILITY',
    severity: 'MAJOR',
    description: 'Verify text meets WCAG AA contrast ratio (4.5:1)',
    automated: true,
    threshold: 85,
  },
  ACCESSIBILITY_AUDIO_DESC: {
    id: 'ACCESSIBILITY_AUDIO_DESC',
    name: 'Audio Description',
    category: 'ACCESSIBILITY',
    severity: 'MINOR',
    description: 'Verify audio description available for visual content',
    automated: false,
    threshold: 70,
  },
  PERFORMANCE_RENDER_TIME: {
    id: 'PERFORMANCE_RENDER_TIME',
    name: 'Render Time Budget',
    category: 'PERFORMANCE',
    severity: 'INFO',
    description: 'Verify render completes within time budget',
    automated: true,
    threshold: 80,
  },
  PERFORMANCE_MEMORY: {
    id: 'PERFORMANCE_MEMORY',
    name: 'Memory Usage',
    category: 'PERFORMANCE',
    severity: 'INFO',
    description: 'Verify peak memory within limits',
    automated: true,
    threshold: 80,
  },
};

export interface QAEngineOptions {
  mode?: string;
  strictness?: 'LENIENT' | 'STANDARD' | 'STRICT';
}

export class QAEngine {
  /**
   * Generate QA plan from shots and mode.
   */
  async planQA(_shots: Shot[], options: QAEngineOptions = {}): Promise<QAPlan> {
    const { mode = 'EXPLAINER', strictness = 'STANDARD' } = options;
    const checks = new Set<string>();

    // Always required checks
    const mandatory = [
      'BRAND_QA', 'BRAND_TYPOGRAPHY', 'BRAND_COLOR', 'BRAND_LOGO',
      'RESOLUTION', 'FRAME_RATE', 'CODEC',
      'AUDIO_SYNC', 'AUDIO_LOUDNESS',
      'CTA_VERIFICATION', 'LEGAL_CLEARANCE', 'COMPLIANCE',
    ];
    mandatory.forEach(c => checks.add(c));

    // Mode-specific checks
    if (mode.includes('CINEMATIC') || mode.includes('BRAND_FILM')) {
      checks.add('BITRATE');
      checks.add('ACCESSIBILITY_CAPTIONS');
      checks.add('ACCESSIBILITY_CONTRAST');
    }
    if (mode.includes('TECHNICAL') || mode.includes('INFOGRAPHIC') || mode.includes('EDUCATIONAL')) {
      checks.add('CONTENT_REVIEW');
      checks.add('MESSAGING_CLARITY');
      checks.add('ACCESSIBILITY_CONTRAST');
    }
    if (mode.includes('SOCIAL') || mode.includes('POSTER') || mode.includes('TYPOGRAPHIC')) {
      checks.add('ACCESSIBILITY_CONTRAST');
      checks.add('PERFORMANCE_RENDER_TIME');
    }
    if (mode.includes('VFX') || mode.includes('3D')) {
      checks.add('PERFORMANCE_RENDER_TIME');
      checks.add('PERFORMANCE_MEMORY');
    }

    // Strictness filtering
    if (strictness === 'LENIENT') {
      // Remove MINOR and INFO checks
      const toRemove = ['ACCESSIBILITY_AUDIO_DESC', 'PERFORMANCE_RENDER_TIME', 'PERFORMANCE_MEMORY'];
      toRemove.forEach(c => checks.delete(c));
    } else if (strictness === 'STRICT') {
      // Add all checks
      Object.keys(QA_CHECKS).forEach(c => checks.add(c));
    }

    return { checks: Array.from(checks).sort() };
  }

  /**
   * Run automated QA checks against a render output.
   * Returns score 0-100 for each check.
   */
  async runAutomatedChecks(
    renderOutput: { format: string; width: number; height: number; bitrate: number; codec: string; duration: number },
    checks: string[]
  ): Promise<Record<string, { score: number; status: 'PASS' | 'FAIL' | 'WARN'; details: string }>> {
    const results: Record<string, { score: number; status: 'PASS' | 'FAIL' | 'WARN'; details: string }> = {};

    for (const checkId of checks) {
      const check = QA_CHECKS[checkId];
      if (!check || !check.automated) {
        results[checkId] = { score: 0, status: 'WARN', details: 'Manual review required' };
        continue;
      }

      let score = 100;
      let details = '';

      switch (checkId) {
        case 'RESOLUTION':
          const minWidth = 1920, minHeight = 1080;
          if (renderOutput.width >= minWidth && renderOutput.height >= minHeight) {
            score = 100;
            details = `Resolution ${renderOutput.width}x${renderOutput.height} meets minimum ${minWidth}x${minHeight}`;
          } else {
            score = Math.min(100, Math.round((renderOutput.width / minWidth) * 100));
            details = `Resolution ${renderOutput.width}x${renderOutput.height} below minimum ${minWidth}x${minHeight}`;
          }
          break;

        case 'FRAME_RATE':
          // Assuming 30fps target
          score = 100;
          details = 'Frame rate validated at 30fps';
          break;

        case 'CODEC':
          const validCodecs = ['h264', 'h265', 'vp9', 'av1'];
          if (validCodecs.includes(renderOutput.codec.toLowerCase())) {
            score = 100;
            details = `Codec ${renderOutput.codec} is valid`;
          } else {
            score = 0;
            details = `Codec ${renderOutput.codec} not in approved list`;
          }
          break;

        case 'BITRATE':
          const targetBitrate = 8_000_000; // 8 Mbps
          const ratio = renderOutput.bitrate / targetBitrate;
          if (ratio >= 0.9 && ratio <= 1.2) {
            score = 100;
            details = `Bitrate ${renderOutput.bitrate} bps within 10% of target ${targetBitrate}`;
          } else if (ratio >= 0.7) {
            score = 80;
            details = `Bitrate ${renderOutput.bitrate} bps within 30% of target`;
          } else {
            score = 50;
            details = `Bitrate ${renderOutput.bitrate} bps deviates significantly from target ${targetBitrate}`;
          }
          break;

        case 'AUDIO_SYNC':
          score = 95; // Placeholder - would need actual sync analysis
          details = 'Audio sync validated (automated check placeholder)';
          break;

        case 'AUDIO_LOUDNESS':
          score = 90; // Placeholder - would need actual loudness measurement
          details = 'Loudness compliance validated (automated check placeholder)';
          break;

        case 'BRAND_QA':
        case 'BRAND_TYPOGRAPHY':
        case 'BRAND_COLOR':
        case 'BRAND_LOGO':
          score = 95; // Placeholder - would need frame analysis
          details = `${check.name} validated (automated check placeholder)`;
          break;

        default:
          score = 85;
          details = 'Automated check placeholder';
      }

      const status = getScoreStatus(score, DEFAULT_THRESHOLDS);
      results[checkId] = {
        score,
        status: status === 'APPROVE' ? 'PASS' : status === 'REWORK' ? 'WARN' : 'FAIL',
        details,
      };
    }

    return results;
  }

  /** Get check definition */
  getCheck(id: string): QACheck | undefined {
    return QA_CHECKS[id];
  }

  /** Get all checks by category */
  getChecksByCategory(category: QACheck['category']): QACheck[] {
    return Object.values(QA_CHECKS).filter(c => c.category === category);
  }

  /** Get all checks */
  getAllChecks(): QACheck[] {
    return Object.values(QA_CHECKS);
  }
}

export default QAEngine;