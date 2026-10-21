// biome-ignore-all lint/a11y/noStaticElementInteractions: SVG node editor canvas
// biome-ignore-all lint/a11y/useKeyWithClickEvents: SVG node editor canvas
import { useCallback, useRef, useState } from 'react';
import { getNodeTypes } from '../engine/nodes';
import type { DAG, NodeInstance } from '../engine/types';

interface NodeEditorProps {
  dag: DAG;
  selectedNode: string | null;
  onSelectNode: (id: string | null) => void;
  onAddNode: (type: string, position: { x: number; y: number }) => void;
  onRemoveNode: (id: string) => void;
  onUpdateNode: (id: string, updates: Partial<NodeInstance>) => void;
  onAddEdge: (
    from: { node: string; port: string },
    to: { node: string; port: string },
  ) => string | null;
  onRemoveEdge: (id: string) => void;
}

const NODE_W = 140;
const NODE_H = 56;
const PORT_R = 5;

export function NodeEditor({
  dag,
  selectedNode,
  onSelectNode,
  onAddNode,
  onRemoveNode,
  onUpdateNode,
  onAddEdge,
  onRemoveEdge: _onRemoveEdge,
}: NodeEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connecting, setConnecting] = useState<{
    node: string;
    port: string;
    x: number;
    y: number;
  } | null>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  /** Why the last connection was refused, if it was. */
  const [edgeError, setEdgeError] = useState<string | null>(null);

  const nodeTypes = getNodeTypes();

  const _getNodeAt = useCallback(
    (x: number, y: number) => {
      for (let i = dag.nodes.length - 1; i >= 0; i--) {
        const n = dag.nodes[i];
        if (
          x >= n.position.x &&
          x <= n.position.x + NODE_W &&
          y >= n.position.y &&
          y <= n.position.y + NODE_H
        ) {
          return n;
        }
      }
      return null;
    },
    [dag.nodes],
  );

  const getPortPosition = useCallback(
    (nodeId: string, portId: string, isInput: boolean) => {
      const node = dag.nodes.find((n) => n.id === nodeId);
      if (!node) return { x: 0, y: 0 };
      const ports = nodeTypes.find((t) => t.type === node.type)?.ports ?? [];
      const portIndex = ports
        .filter((p) => p.direction === (isInput ? 'input' : 'output'))
        .findIndex((p) => p.id === portId);
      const y = node.position.y + 20 + portIndex * 16;
      const x = isInput ? node.position.x : node.position.x + NODE_W;
      return { x, y };
    },
    [dag.nodes, nodeTypes],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      const node = dag.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      setDragging(nodeId);
      setDragOffset({
        x: e.clientX - rect.left - node.position.x,
        y: e.clientY - rect.top - node.position.y,
      });
      onSelectNode(nodeId);
    },
    [dag.nodes, onSelectNode],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMouse({ x, y });
      if (dragging) {
        onUpdateNode(dragging, { position: { x: x - dragOffset.x, y: y - dragOffset.y } });
      }
      if (connecting) {
        setConnecting({ ...connecting, x, y });
      }
    },
    [dragging, dragOffset, connecting, onUpdateNode],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setConnecting(null);
  }, []);

  const handlePortClick = useCallback(
    (nodeId: string, portId: string, isInput: boolean) => {
      if (connecting) {
        if (connecting.node !== nodeId && connecting.port !== portId) {
          // The connection is checked before it is made; a refused one says
          // why rather than failing later as an opaque shader error.
          const error = isInput
            ? onAddEdge(
                { node: connecting.node, port: connecting.port },
                { node: nodeId, port: portId },
              )
            : onAddEdge(
                { node: nodeId, port: portId },
                { node: connecting.node, port: connecting.port },
              );
          setEdgeError(error);
        }
        setConnecting(null);
      } else {
        setEdgeError(null);
        setConnecting({ node: nodeId, port: portId, x: 0, y: 0 });
      }
    },
    [connecting, onAddEdge],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('nodeType');
      if (!type) return;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      onAddNode(type, {
        x: e.clientX - rect.left - NODE_W / 2,
        y: e.clientY - rect.top - NODE_H / 2,
      });
    },
    [onAddNode],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 min-h-0">
        {/* Node Palette */}
        <div className="w-36 border-r border-line bg-ink-2 p-2 overflow-y-auto shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-2">
            Nodes
          </div>
          <div className="space-y-1">
            {nodeTypes.map((t) => (
              <div
                key={t.type}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('nodeType', t.type)}
                className="px-2 py-1.5 rounded bg-ink border border-line text-[10px] font-medium cursor-grab hover:border-accent/40 transition-colors"
              >
                {t.label}
              </div>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden">
          <svg
            ref={svgRef}
            className="w-full h-full"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={(e) => {
              if (e.target === svgRef.current) onSelectNode(null);
            }}
          >
            <title>Node editor canvas</title>
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1a1e28" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Edges */}
            {dag.edges.map((e) => {
              const from = getPortPosition(e.from.node, e.from.port, false);
              const to = getPortPosition(e.to.node, e.to.port, true);
              const midX = (from.x + to.x) / 2;
              return (
                <g key={e.id} className="cursor-pointer">
                  <path
                    d={`M${from.x},${from.y} C${midX},${from.y} ${midX},${to.y} ${to.x},${to.y}`}
                    fill="none"
                    stroke="#5eead4"
                    strokeWidth="1.5"
                    opacity="0.6"
                  />
                  <path
                    d={`M${from.x},${from.y} C${midX},${from.y} ${midX},${to.y} ${to.x},${to.y}`}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="8"
                  />
                </g>
              );
            })}

            {/* Connection in progress */}
            {connecting && (
              <line
                x1={connecting.x}
                y1={connecting.y}
                x2={mouse.x}
                y2={mouse.y}
                stroke="#ff5a2c"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
            )}

            {/* Nodes */}
            {dag.nodes.map((n) => {
              const type = nodeTypes.find((t) => t.type === n.type);
              const isSelected = selectedNode === n.id;
              return (
                <g key={n.id} transform={`translate(${n.position.x},${n.position.y})`}>
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx="6"
                    fill={isSelected ? '#1a1e28' : '#12151d'}
                    stroke={isSelected ? '#ff5a2c' : '#232836'}
                    strokeWidth={isSelected ? 2 : 1}
                    onMouseDown={(e) => handleMouseDown(e, n.id)}
                    className="cursor-move"
                  />
                  <rect
                    width={NODE_W}
                    height="3"
                    rx="1.5"
                    fill={isSelected ? '#ff5a2c' : '#232836'}
                  />
                  <text x="10" y="22" fill="#e8eaef" fontSize="11" fontWeight="600">
                    {type?.label ?? n.type}
                  </text>
                  <text x="10" y="38" fill="#8a90a0" fontSize="9">
                    {type?.category}
                  </text>

                  {/* Input ports */}
                  {type?.ports
                    .filter((p) => p.direction === 'input')
                    .map((p, i) => (
                      <circle
                        key={p.id}
                        cx={0}
                        cy={20 + i * 16}
                        r={PORT_R}
                        fill="#12151d"
                        stroke="#5eead4"
                        strokeWidth="1.5"
                        className="cursor-crosshair"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePortClick(n.id, p.id, true);
                        }}
                      />
                    ))}

                  {/* Output ports */}
                  {type?.ports
                    .filter((p) => p.direction === 'output')
                    .map((p, i) => (
                      <circle
                        key={p.id}
                        cx={NODE_W}
                        cy={20 + i * 16}
                        r={PORT_R}
                        fill="#12151d"
                        stroke="#ff5a2c"
                        strokeWidth="1.5"
                        className="cursor-crosshair"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePortClick(n.id, p.id, false);
                        }}
                      />
                    ))}
                </g>
              );
            })}
          </svg>

          {/* Delete button */}
          {selectedNode && (
            <button
              type="button"
              onClick={() => onRemoveNode(selectedNode)}
              className="absolute top-2 right-2 px-2 py-1 rounded bg-red-500/20 text-red-400 text-[10px] font-medium hover:bg-red-500/30 transition-colors"
            >
              Delete Node
            </button>
          )}
        </div>
      </div>

      {/* Why a connection was refused. */}
      {edgeError && (
        <div
          role="status"
          className="shrink-0 border-t border-line bg-red-500/10 px-3 py-2 text-[11px] text-red-300"
        >
          {edgeError}
        </div>
      )}
    </div>
  );
}
