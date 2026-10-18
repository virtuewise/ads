import { motion } from 'motion/react';

export function NodeGraph() {
  const nodes = [
    { id: 'data', x: 60, y: 80, title: 'Data Source', sub: 'values: number[]', color: '#232836' },
    {
      id: 'transform',
      x: 280,
      y: 80,
      title: 'Transform',
      sub: 'scale · offset · ease',
      color: '#232836',
    },
    {
      id: 'kinetic',
      x: 500,
      y: 80,
      title: 'Kinetic Type',
      sub: 'font · weight · stagger',
      color: '#232836',
    },
    { id: 'render', x: 720, y: 80, title: 'Render', sub: 'motion frame', color: '#ff5a2c' },
  ];

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Node Graph — Shader Nodes</h3>
        <p className="text-xs text-muted">
          Structure motion visuals as a node tree. Connect data → transform → render. Write custom
          WGSL shaders.
        </p>
      </div>
      <svg
        className="w-full max-w-[920px]"
        viewBox="0 0 900 420"
        role="img"
        aria-label="Node graph"
      >
        <title>Node graph</title>
        <defs>
          <linearGradient id="nodeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff5a2c" />
            <stop offset="100%" stopColor="#5eead4" />
          </linearGradient>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="#5eead4" />
          </marker>
        </defs>
        {nodes.map((n, i, arr) => (
          <motion.g
            key={n.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.3 }}
            transform={`translate(${n.x},${n.y})`}
          >
            <rect
              width="160"
              height="70"
              rx="8"
              fill="#171b24"
              stroke={n.color}
              strokeWidth="1.5"
            />
            <rect width="160" height="3" rx="1.5" fill="url(#nodeGrad)" />
            <text x="14" y="28" fill="#e8eaef" fontSize="12" fontWeight="600">
              {n.title}
            </text>
            <text x="14" y="48" fill="#8a90a0" fontSize="10">
              {n.sub}
            </text>
            {i < arr.length - 1 && (
              <path
                d="M160 35 C 195 35, 195 35, 230 35"
                stroke="#5eead4"
                strokeWidth="2"
                fill="none"
                markerEnd="url(#arrow)"
              />
            )}
          </motion.g>
        ))}
      </svg>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg border border-line bg-ink-2">
          <div className="text-xs font-semibold mb-2">Shader Node (WGSL)</div>
          <div className="text-[10px] text-muted font-mono">
            Custom WGSL code runs natively on the GPU at 60+ FPS
          </div>
        </div>
        <div className="p-3 rounded-lg border border-line bg-ink-2">
          <div className="text-xs font-semibold mb-2">Extension Sandbox</div>
          <div className="text-[10px] text-muted font-mono">
            Write JavaScript/TypeScript to automate the timeline
          </div>
        </div>
      </div>
    </div>
  );
}
