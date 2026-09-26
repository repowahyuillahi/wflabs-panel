import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ACTIVE_WINDOW_MS, fadeOpacity } from "@/lib/graph-helpers";

export interface RackNode {
  id: string;
  label: string;
  sub?: string;
  short: string;
  bg: string;
  fg: string;
  opacity?: number;
  /** Timestamp traffic terakhir (ms). Fade dihitung lokal di sini. */
  seenAt?: number;
  /** Opacity saat idle (tidak ada traffic dalam window). */
  dimOpacity?: number;
  ghost?: boolean;
}

interface HubGraphProps {
  left: RackNode[];
  right: RackNode[];
  activeLeft: string | null;
  activeRight: string | null;
  activeCount: number;
  hubHot: boolean;
}

const HUB_POSITION = { x: 356, y: 140 };
const LEFT_X = 14;
const RIGHT_X = 592;

function colY(count: number, index: number): number {
  if (count <= 1) return 140;
  const gap = 252 / (count - 1);
  if (gap >= 44) return 24 + index * gap;
  // Rack penuh: rapat minimum 44px, kolom tetap terpusat di hub
  const h = 44 * (count - 1);
  return Math.max(8, 140 - h / 2) + index * 44;
}

function RackNodeView({ data }: { data: any }) {
  const active = !!data.active;
  const ghost = !!data.ghost;
  return (
    <div
      title={data.sub ? `${data.label} — ${data.sub}` : data.label}
      style={{ opacity: data.opacity ?? 1 }}
      className={`rack-enter flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-md border bg-white dark:bg-zinc-900 transition-colors duration-300 whitespace-nowrap max-w-[170px] ${
        ghost
          ? "border-dashed border-stone-200 dark:border-zinc-700"
          : active
            ? "border-amber-500"
            : "border-[#e7e0e0] dark:border-zinc-700"
      }`}
    >
      <Handle
        type={data.handle === "source" ? "source" : "target"}
        position={data.handle === "source" ? Position.Left : Position.Right}
        style={{ opacity: 0, width: 8, height: 8 }}
      />
      <span
        className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold shrink-0"
        style={{ backgroundColor: data.bg, color: data.fg }}
      >
        {data.short}
      </span>
      <span className="block text-xs font-medium truncate leading-tight text-stone-700 dark:text-zinc-200">
        {data.label}
      </span>
    </div>
  );
}

function HubNode({ data }: { data: any }) {
  const hot = !!data.hot;
  const count = Number(data.count || 0);
  return (
    <div
      className={`flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-md border bg-white dark:bg-zinc-900 transition-colors duration-300 whitespace-nowrap ${
        hot ? "border-orange-500" : "border-orange-200 dark:border-orange-900"
      }`}
    >
      <Handle type="source" position={Position.Left} style={{ opacity: 0, width: 8, height: 8 }} />
      <Handle type="target" position={Position.Right} style={{ opacity: 0, width: 8, height: 8 }} />
      <div className="w-5 h-5 rounded bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
        9
      </div>
      <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">9Router</span>
      {count > 0 && (
        <span className="min-w-4 h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
          {count}
        </span>
      )}
    </div>
  );
}

const nodeTypes = {
  hub: HubNode,
  rack: RackNodeView,
};

export const HubGraph = memo(function HubGraph({ left, right, activeLeft, activeRight, activeCount, hubHot }: HubGraphProps) {
  // Kiri (provider) tampil SEMUA; kanan (client) 6 teratas (diurutkan parent: terbaru dulu)
  const leftNodes = left;
  const rightNodes = right.slice(0, 6);
  const posRef = useRef(new Map<string, { x: number; y: number }>());
  // Saat user menggeser node, kunci props nodes agar poll data tidak merebut posisi (anti-tegang)
  const [dragging, setDragging] = useState(false);
  const nodesCache = useRef<Node[]>([]);
  // Fade tick LOKAL (murah, hanya subtree graph) — dashboard tidak ikut re-render
  const [fadeTick, setFadeTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setFadeTick((v) => v + 1), 2000);
    return () => clearInterval(t);
  }, []);

  const handleNodesChange = (changes: any[]) => {
    for (const c of changes) {
      if (c && c.type === "position" && c.position) {
        posRef.current.set(c.id, { x: c.position.x, y: c.position.y });
      }
    }
  };

  const freshNodes: Node[] = useMemo(() => {
    const ids = new Set<string>(["hub", ...leftNodes.map((s) => s.id), ...rightNodes.map((s) => s.id)]);
    for (const k of [...posRef.current.keys()]) {
      if (!ids.has(k)) posRef.current.delete(k);
    }
    const now = Date.now();
    const op = (s: RackNode) => {
      if (s.ghost) return s.opacity ?? 0.85;
      const ts = s.seenAt ?? 0;
      if (ts > 0 && now - ts < ACTIVE_WINDOW_MS) return fadeOpacity(now - ts);
      return s.dimOpacity ?? 0.6;
    };
    const placed = (id: string, x: number, y: number) => posRef.current.get(id) ?? { x, y };
    return [
      {
        id: "hub",
        type: "hub",
        position: placed("hub", HUB_POSITION.x, HUB_POSITION.y),
        data: { count: activeCount, hot: hubHot },
      },
      ...leftNodes.map((s, i) => ({
        id: s.id,
        type: "rack",
        position: placed(s.id, LEFT_X, colY(leftNodes.length, i)),
        data: {
          label: s.label,
          sub: s.sub || "",
          short: s.short,
          bg: s.bg,
          fg: s.fg,
          handle: "target",
          accent: "amber",
          opacity: op(s),
          ghost: !!s.ghost,
          active: activeLeft !== null && s.id === activeLeft,
        },
      })),
      ...rightNodes.map((s, i) => ({
        id: s.id,
        type: "rack",
        position: placed(s.id, RIGHT_X, colY(rightNodes.length, i)),
        data: {
          label: s.label,
          sub: s.sub || "",
          short: s.short,
          bg: s.bg,
          fg: s.fg,
          handle: "source",
          accent: "cyan",
          opacity: op(s),
          ghost: !!s.ghost,
          active: activeRight !== null && s.id === activeRight,
        },
      })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftNodes, rightNodes, activeLeft, activeRight, activeCount, hubHot, fadeTick]);

  const nodes = dragging && nodesCache.current.length > 0 ? nodesCache.current : freshNodes;
  if (!dragging) nodesCache.current = freshNodes;

  const overflowRight = right.length - rightNodes.length;
  const allNodes: Node[] =
    overflowRight > 0
      ? [
          ...nodes,
          {
            id: "__overflow-right",
            type: "rack",
            position: posRef.current.get("__overflow-right") ?? {
              x: RIGHT_X,
              y: colY(rightNodes.length + 1, rightNodes.length),
            },
            data: {
              label: `+${overflowRight} more`,
              sub: "",
              short: "+",
              bg: "#f1f5f9",
              fg: "#94a3b8",
              handle: "source",
              accent: "cyan",
              opacity: 0.8,
              ghost: true,
              active: false,
            },
          },
        ]
      : nodes;

  const edges: Edge[] = useMemo(
    () => [
      // OUTPUT leg: hub -> pool (kiri). Kurva bezier tipis ala 9Router native.
      ...leftNodes
        .filter((s) => !s.ghost)
        .map((s) => {
          const isActive = activeLeft !== null && s.id === activeLeft;
          return {
            id: `e-${s.id}`,
            source: "hub",
            target: s.id,
            type: "default",
            animated: isActive,
            style: {
              stroke: isActive ? "#f59e0b" : "#ece4e4",
              strokeWidth: isActive ? 2 : 1,
            },
          };
        }),
      // INPUT leg: client/key (kanan) -> hub.
      ...rightNodes
        .filter((s) => !s.ghost)
        .map((s) => {
          const isActive = activeRight !== null && s.id === activeRight;
          return {
            id: `e-${s.id}`,
            source: s.id,
            target: "hub",
            type: "default",
            animated: isActive,
            style: {
              stroke: isActive ? "#f59e0b" : "#ece4e4",
              strokeWidth: isActive ? 2 : 1,
            },
          };
        }),
    ],
    [leftNodes, rightNodes, activeLeft, activeRight]
  );

  return (
    <div className="w-full h-[360px] bg-white dark:bg-[#0c0c0e] relative">
      <ReactFlow
        nodes={allNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onNodeDragStart={() => setDragging(true)}
        onNodeDragStop={() => setDragging(false)}
        onInit={(inst: any) => {
          try {
            inst.fitView({ padding: 0.24, maxZoom: 1 });
          } catch {}
        }}
        minZoom={0.4}
        maxZoom={1.75}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        onlyRenderVisibleElements
        zoomOnScroll={false}
        attributionPosition="bottom-right"
      >
        <Background variant={BackgroundVariant.Lines} gap={28} size={1} color="rgba(200,170,170,0.22)" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
    </div>
  );
});
