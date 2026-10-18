import { useCallback, useState } from 'react';

interface ScriptEditorProps {
  code: string;
  onSync: (code: string) => void;
  compiledWGSL: string;
}

export function ScriptEditor({ code, onSync, compiledWGSL }: ScriptEditorProps) {
  const [activeTab, setActiveTab] = useState<'code' | 'wgsl'>('code');
  const [localCode, setLocalCode] = useState(code);
  const [syncing, setSyncing] = useState(false);

  const handleSync = useCallback(() => {
    setSyncing(true);
    onSync(localCode);
    setTimeout(() => setSyncing(false), 300);
  }, [localCode, onSync]);

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-line bg-ink-2 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('code')}
          className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${activeTab === 'code' ? 'bg-white/10 text-text' : 'text-muted hover:text-text'}`}
        >
          Node Graph Code
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('wgsl')}
          className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${activeTab === 'wgsl' ? 'bg-white/10 text-text' : 'text-muted hover:text-text'}`}
        >
          Compiled WGSL
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="px-2.5 py-1 rounded bg-accent/10 text-accent text-[10px] font-medium hover:bg-accent/20 transition-colors disabled:opacity-50"
        >
          {syncing ? 'Syncing…' : 'Sync to Graph'}
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'code' ? (
          <textarea
            value={localCode}
            onChange={(e) => setLocalCode(e.target.value)}
            className="w-full h-full p-3 bg-ink text-text font-mono text-[11px] leading-relaxed resize-none outline-none"
            spellCheck={false}
          />
        ) : (
          <pre className="w-full h-full p-3 bg-ink text-cool font-mono text-[11px] leading-relaxed overflow-auto whitespace-pre-wrap">
            {compiledWGSL}
          </pre>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 px-3 py-1 border-t border-line bg-ink-2 text-[9px] text-muted font-mono shrink-0">
        <span>Code ↔ Node sync active</span>
        <span>·</span>
        <span>WGSL auto-compiled</span>
        <span>·</span>
        <span>WebGPU ready</span>
      </div>
    </div>
  );
}
