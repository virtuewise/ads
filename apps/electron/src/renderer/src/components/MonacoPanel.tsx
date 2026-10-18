import { useEffect, useState } from 'react';

const DEFAULT_CODE = `// Monaco Editor — script your motion
// Write WGSL shaders, automation scripts, or expressions

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function animateLayer(layer: any, from: number, to: number, duration: number) {
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min((now - start) / (duration * 1000), 1);
    layer.opacity = from + (to - from) * easeInOut(t);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Trigger on timeline play
onPlay(() => {
  animateLayer(scene.title, 0, 1, 1.2);
});
`;

export function MonacoPanel() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [language, setLanguage] = useState('typescript');

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-line bg-ink-2 shrink-0">
        <span className="text-xs font-semibold">Code Editor</span>
        <div className="flex-1" />
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="px-2 py-1 rounded bg-ink border border-line text-xs"
        >
          <option value="typescript">TypeScript</option>
          <option value="wgsl">WGSL</option>
          <option value="javascript">JavaScript</option>
        </select>
        <button
          type="button"
          className="px-2.5 py-1 rounded bg-accent text-white text-xs font-medium"
        >
          Run
        </button>
      </div>
      <div className="flex-1">
        <LazyEditor value={code} onChange={setCode} language={language} />
      </div>
    </div>
  );
}

function LazyEditor({
  value,
  onChange,
  language,
}: {
  value: string;
  onChange: (v: string) => void;
  language: string;
}) {
  const [Editor, setEditor] = useState<typeof import('@monaco-editor/react').default | null>(null);
  useEffect(() => {
    import('@monaco-editor/react').then((m) => setEditor(() => m.default));
  }, []);
  if (!Editor)
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        Loading editor…
      </div>
    );
  return (
    <Editor
      height="100%"
      language={language}
      theme="vs-dark"
      value={value}
      onChange={(v: string | undefined) => onChange(v ?? '')}
      options={{
        fontSize: 12,
        fontFamily: 'JetBrains Mono, SF Mono, monospace',
        minimap: { enabled: false },
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        padding: { top: 8, bottom: 8 },
      }}
    />
  );
}
