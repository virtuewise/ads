import { motion } from 'motion/react';
import { useState } from 'react';

export function Timeline() {
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [duration] = useState(5);
  const [_selectedTrack, setSelectedTrack] = useState<string | null>(null);

  const tracks = [
    {
      id: 'video',
      label: 'Video',
      color: '#ff5a2c',
      clips: [
        { start: 0, end: 2.5, name: 'Main Clip' },
        { start: 2.8, end: 5, name: 'B-Roll' },
      ],
    },
    {
      id: 'audio',
      label: 'Audio',
      color: '#5eead4',
      clips: [{ start: 0, end: 5, name: 'Background Music' }],
    },
    {
      id: 'captions',
      label: 'Captions',
      color: '#ffb347',
      clips: [
        { start: 0.5, end: 1.5, name: 'Title' },
        { start: 2, end: 3, name: 'Subtitle' },
      ],
    },
    {
      id: 'effects',
      label: 'Effects',
      color: '#a78bfa',
      clips: [
        { start: 1, end: 2, name: 'Glow' },
        { start: 3, end: 4.5, name: 'Blur' },
      ],
    },
    {
      id: 'transitions',
      label: 'Transitions',
      color: '#f472b6',
      clips: [{ start: 2.3, end: 2.8, name: 'Wipe' }],
    },
  ];

  return (
    <div className="h-52 border-t border-line bg-ink-2 flex flex-col shrink-0">
      <div className="flex items-center gap-2 px-4 h-9 border-b border-line shrink-0">
        <button
          type="button"
          onClick={() => setPlaying(!playing)}
          className="px-3 py-1 rounded-md bg-accent text-white text-xs font-medium"
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button
          type="button"
          onClick={() => setPlayhead(0)}
          className="px-3 py-1 rounded-md bg-white/5 text-xs font-medium hover:bg-white/10"
        >
          ⏹ Stop
        </button>
        <span className="text-xs text-muted font-mono ml-2">
          {playhead.toFixed(2)}s / {duration.toFixed(2)}s
        </span>
        <input
          type="range"
          min={0}
          max={duration}
          step={0.01}
          value={playhead}
          onChange={(e) => setPlayhead(Number(e.target.value))}
          className="flex-1 accent-accent h-1 mx-2"
        />
        <span className="text-xs text-muted font-mono">30fps · 1920×1080</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
        {tracks.map((track) => (
          <div key={track.id} className="flex items-center gap-3 h-8">
            <div className="w-24 text-[10px] font-semibold text-muted uppercase tracking-wider shrink-0">
              {track.label}
            </div>
            <button
              type="button"
              className="flex-1 relative h-6 rounded bg-ink border border-line overflow-hidden cursor-pointer border-0 p-0"
              onClick={() => setSelectedTrack(track.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setSelectedTrack(track.id);
              }}
            >
              {track.clips.map((clip, i) => (
                <motion.div
                  key={`${clip.start}-${clip.end}`}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="absolute top-1 bottom-1 rounded px-2 flex items-center text-[10px] font-medium text-white/90 overflow-hidden"
                  style={{
                    left: `${(clip.start / duration) * 100}%`,
                    width: `${((clip.end - clip.start) / duration) * 100}%`,
                    background: `linear-gradient(90deg, ${track.color}66, ${track.color}44)`,
                    borderLeft: `2px solid ${track.color}`,
                  }}
                >
                  {clip.name}
                </motion.div>
              ))}
            </button>
          </div>
        ))}
        <div className="relative h-1 mt-1">
          <motion.div
            className="absolute top-0 h-full w-0.5 bg-accent"
            style={{ left: `${(playhead / duration) * 100}%` }}
            layout
          />
          <div
            className="absolute -top-1 w-2.5 h-2.5 bg-accent rotate-45"
            style={{ left: `calc(${(playhead / duration) * 100}% - 5px)` }}
          />
        </div>
      </div>
    </div>
  );
}
