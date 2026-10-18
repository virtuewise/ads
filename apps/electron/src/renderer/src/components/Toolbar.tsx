import { motion } from 'motion/react';

const TOOLS = [
  { id: 'select', icon: '↖', title: 'Select (V)' },
  { id: 'move', icon: '✥', title: 'Move (V)' },
  { id: 'text', icon: 'T', title: 'Text (T)' },
  { id: 'shape', icon: '□', title: 'Shape (S)' },
  { id: 'node', icon: '⬡', title: 'Node (N)' },
  { id: 'pen', icon: '✎', title: 'Pen (P)' },
  { id: 'hand', icon: '✋', title: 'Hand (H)' },
  { id: 'zoom', icon: '⌕', title: 'Zoom (Z)' },
];

export function Toolbar({ active, onChange }: { active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-2 px-1 bg-ink-2 border-r border-line">
      {TOOLS.map((t) => (
        <motion.button
          key={t.id}
          type="button"
          title={t.title}
          onClick={() => onChange(t.id)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm transition-colors ${active === t.id ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-muted hover:text-text hover:bg-white/5'}`}
        >
          {t.icon}
        </motion.button>
      ))}
      <div className="w-6 h-px bg-line my-1" />
      <motion.button
        type="button"
        title="Zoom in"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-sm text-muted hover:text-text hover:bg-white/5"
      >
        +
      </motion.button>
      <motion.button
        type="button"
        title="Zoom out"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-sm text-muted hover:text-text hover:bg-white/5"
      >
        −
      </motion.button>
    </div>
  );
}
