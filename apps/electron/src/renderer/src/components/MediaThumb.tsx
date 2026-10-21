import { useEffect, useRef } from 'react';

interface MediaThumbProps {
  /** The decoded frame to sample. */
  frame: VideoFrame | null;
  /** Poster width in CSS pixels. */
  width?: number;
}

/**
 * A small poster frame for an imported clip.
 *
 * Drawing the decoded VideoFrame into a 2D canvas proves the decode produced
 * real pixels — a black rectangle means the container was parsed but the
 * frames never made it through the decoder.
 */
export function MediaThumb({ frame, width = 72 }: MediaThumbProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !frame) return;
    const height = Math.round((width * frame.displayHeight) / Math.max(1, frame.displayWidth));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      ctx.drawImage(frame, 0, 0, width, height);
    } catch {
      // The frame may have been closed by the ring buffer evicting it.
    }
  }, [frame, width]);

  return (
    <canvas
      ref={ref}
      className="media__thumb"
      style={{ width: `${width}px` }}
      aria-label="Clip poster frame"
    />
  );
}
