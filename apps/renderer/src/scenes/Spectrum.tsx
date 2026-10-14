import { analyzeFrequencyBands } from '@printsync/audio-engine';
import { useAudioData, visualizeAudio } from '@remotion/media-utils';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

const BRAND = '#c8001c';

interface SpectrumProps {
  audioSrc: string;
  bars?: number;
}

/**
 * Audio-reactive spectrum. Uses Remotion's media utils to decode the track and
 * sample the current frame's frequency spectrum, then collapses it into a
 * fixed number of bands via the shared @printsync/audio-engine primitive.
 */
export const Spectrum: React.FC<SpectrumProps> = ({ audioSrc, bars = 56 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audioData = useAudioData(audioSrc);

  if (!audioData) {
    return null;
  }

  // Remotion requires the FFT sample count to be a power of two; we sample
  // generously, then collapse it into the requested number of visual bars.
  const frequencies = visualizeAudio({
    fps,
    frame,
    audioData,
    numberOfSamples: 256,
  });
  const levels = analyzeFrequencyBands(frequencies, bars);

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 6,
          width: '100%',
          height: '26%',
          padding: '0 120px 80px',
          boxSizing: 'border-box',
        }}
      >
        {levels.map((level, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-count positional spectrum bars; order never changes
            key={index}
            style={{
              flex: 1,
              height: `${Math.max(2, level * 100)}%`,
              borderRadius: 4,
              backgroundColor: BRAND,
              opacity: 0.35 + level * 0.65,
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
