"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  ReactFlow, Background, Controls, MiniMap, addEdge,
  useNodesState, useEdgesState, Handle, Position,
  type Node, type Connection, type NodeProps, type OnConnect, type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Play, Square, Trash2, ChevronDown, Copy, Lock, Unlock, Zap,
  GraduationCap, Info, ChevronRight, ArrowLeft, Settings2, Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useParams, useRouter } from "next/navigation";
import {
  type DebugLog,
  NODE_TYPES_LIST, NODE_COLOR_MAP, NODE_DESC_MAP, TOOL_LABELS, MODELS,
  NODE_TIPS, INITIAL_NODES, INITIAL_EDGES,
  mockNodeOutput, getExecutionPath, sleep,
} from "@/lib/canvas-data";

/* ── 自定义下拉选择器 ── */
function CustomSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/30">
        <span>{current.label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-border bg-popover p-1 shadow-xl shadow-black/20">
          {options.map((o) => (
            <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
              className={cn("flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors",
                o.value === value ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary")}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── 自定义节点组件 ── */
function AgentNode({ data, type, selected }: NodeProps) {
  const color = NODE_COLOR_MAP[type ?? ""] || "#6366f1";
  const d = data as Record<string, unknown>;
  const label = (d.label as string) || type;
  const showBody = ["llm", "condition", "tool"].includes(type ?? "");
  const isRunning = d._running as boolean | undefined;
  const isFrozen = d._frozen as boolean | undefined;
  const lastOutput = d._lastOutput as string | undefined;

  return (
    <div className={cn("min-w-[160px] rounded-xl border-2 bg-card shadow-lg shadow-black/20 transition-all",
      selected && "ring-2 ring-primary/50", isRunning && "ring-2 ring-orange-400/60 animate-pulse", isFrozen && "opacity-70")}
      style={{ borderColor: isRunning ? "#f97316" : color }}>
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-card !bg-muted-foreground" />
      <div className="flex items-center justify-center gap-1.5 rounded-t-[10px] px-4 py-2 text-center text-sm font-semibold text-white"
        style={{ background: isRunning ? "#f97316" : color }}>
        {isFrozen && <Lock className="h-3 w-3" />}
        {label}
      </div>
      {showBody && (
        <div className="px-3 py-2">
          {type === "llm" && (
            <div className="flex flex-wrap gap-1">
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">{(d.model as string) || "gpt-4o"}</span>
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">T={String(d.temperature ?? 0.7)}</span>
            </div>
          )}
          {type === "condition" && <p className="truncate text-[11px] italic text-muted-foreground">{(d.expression as string) || "未配置"}</p>}
          {type === "tool" && <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">{TOOL_LABELS[(d.toolType as string)] || (d.toolType as string)}</span>}
        </div>
      )}
      {lastOutput && (
        <div className="border-t border-border px-3 py-1.5">
          <p className="truncate text-[10px] text-emerald-400">✓ {lastOutput}</p>
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-card !bg-muted-foreground" />
    </div>
  );
}

/* ── 右键菜单 ── */
interface ContextMenuState { nodeId: string; x: number; y: number; }

function NodeContextMenu({ menu, onClose, onRunSingle, onDuplicate, onToggleFreeze, onDelete, isFrozen }: {
  menu: ContextMenuState; onClose: () => void; onRunSingle: (id: string) => void;
  onDuplicate: (id: string) => void; onToggleFreeze: (id: string) => void; onDelete: (id: string) => void; isFrozen: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as globalThis.Node)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const items = [
    { icon: Zap, label: "单独运行此节点", color: "text-emerald-400", action: () => onRunSingle(menu.nodeId) },
    { icon: isFrozen ? Unlock : Lock, label: isFrozen ? "解冻节点" : "冻结节点（锁定输出）", color: "text-foreground", action: () => onToggleFreeze(menu.nodeId) },
    { icon: Copy, label: "复制节点", color: "text-foreground", action: () => onDuplicate(menu.nodeId) },
    { icon: Trash2, label: "删除节点", color: "text-destructive", action: () => onDelete(menu.nodeId) },
  ];

  return (
    <div ref={ref} className="fixed z-[100] w-52 rounded-xl border border-border bg-popover p-1.5 shadow-2xl shadow-black/30" style={{ left: menu.x, top: menu.y }}>
      {items.map((item, i) => (
        <button key={i} onClick={() => { item.action(); onClose(); }}
          className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-secondary", item.color)}>
          <item.icon className="h-3.5 w-3.5" />
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* ── 节点配置面板 ── */
function ConfigPanel({ node, setNodes }: {
  node: Node; setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
}) {
  const d = node.data as Record<string, unknown>;
  const tip = NODE_TIPS[node.id];
  const desc = NODE_DESC_MAP[node.type ?? ""] || "";
  const isFrozen = d._frozen as boolean | undefined;

  const updateData = (key: string, value: unknown) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, [key]: value } } : n))
    );
  };

  const deleteNode = () => {
    setNodes((nds) => nds.filter((n) => n.id !== node.id));
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* 教学提示 */}
      {tip && (
        <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3">
          <p className="text-sm leading-relaxed text-indigo-300">{tip}</p>
        </div>
      )}

      {/* 节点描述 */}
      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
        <p>{desc}</p>
      </div>

      {/* 快捷操作 */}
      <div className="flex gap-2">
        <button
          onClick={() => updateData("_frozen", !isFrozen)}
          className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors",
            isFrozen ? "bg-amber-500/15 text-amber-400" : "bg-secondary text-muted-foreground hover:text-foreground")}
        >
          {isFrozen ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          {isFrozen ? "解冻" : "冻结"}
        </button>
      </div>

      {/* 节点名称 */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">节点名称</label>
        <input
          value={(d.label as string) || ""}
          onChange={(e) => updateData("label", e.target.value)}
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {/* LLM 配置 */}
      {node.type === "llm" && (
        <>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">模型</label>
            <CustomSelect
              value={(d.model as string) || "gpt-4o"}
              onChange={(v) => updateData("model", v)}
              options={MODELS.map((m) => ({ value: m, label: m }))}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">System Prompt</label>
            <div className="mb-1.5 flex flex-wrap gap-1">
              {["{{input}}", "{{context}}", "{{history}}"].map((v) => (
                <button key={v} onClick={() => updateData("systemPrompt", ((d.systemPrompt as string) || "") + " " + v)}
                  className="rounded bg-indigo-500/15 px-2 py-0.5 text-[11px] text-indigo-400 transition-colors hover:bg-indigo-500/25">
                  {v}
                </button>
              ))}
            </div>
            <textarea
              value={(d.systemPrompt as string) || ""}
              onChange={(e) => updateData("systemPrompt", e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div>
            <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>温度 (Temperature)</span>
              <span className="text-foreground">{String(d.temperature ?? 0.7)}</span>
            </label>
            <input
              type="range" min="0" max="1" step="0.1"
              value={Number(d.temperature ?? 0.7)}
              onChange={(e) => updateData("temperature", parseFloat(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/60">
              <span>精确</span><span>创意</span>
            </div>
          </div>
        </>
      )}

      {/* 条件配置 */}
      {node.type === "condition" && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">判断表达式</label>
          <input
            value={(d.expression as string) || ""}
            onChange={(e) => updateData("expression", e.target.value)}
            placeholder='例: intent === "search"'
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm font-mono text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
      )}

      {/* 工具配置 */}
      {node.type === "tool" && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">工具类型</label>
          <CustomSelect
            value={(d.toolType as string) || "web_search"}
            onChange={(v) => updateData("toolType", v)}
            options={Object.entries(TOOL_LABELS).map(([k, v]) => ({ value: k, label: v }))}
          />
        </div>
      )}

      {/* 上次输出 */}
      {(d._lastOutput as string) && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">上次运行输出</label>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="text-sm text-emerald-400">{d._lastOutput as string}</p>
          </div>
        </div>
      )}

      {/* 删除 */}
      <button onClick={deleteNode}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/30 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10">
        <Trash2 className="h-3.5 w-3.5" />
        删除节点
      </button>
    </div>
  );
}

/* ── 主页面组件 ── */
const nodeTypes: NodeTypes = { start: AgentNode, llm: AgentNode, condition: AgentNode, tool: AgentNode, end: AgentNode };

export default function AgentFlowPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.id as string;

  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const onConnect: OnConnect = useCallback((conn: Connection) => setEdges((eds) => addEdge(conn, eds)), [setEdges]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [rightTab, setRightTab] = useState<"guide" | "config" | "debug">("guide");
  const [isRunning, setIsRunning] = useState(false);
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [simpleMode, setSimpleMode] = useState(false);

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId), [nodes, selectedNodeId]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setRightTab("config");
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setContextMenu(null);
  }, []);

  const handleNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    setContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY });
  }, []);

  /* 拖拽添加节点 */
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const typeData = e.dataTransfer.getData("application/reactflow");
    if (!typeData) return;
    const item = NODE_TYPES_LIST.find((n) => n.type === typeData);
    if (!item) return;
    const newNode: Node = {
      id: `${Date.now()}`,
      type: item.type,
      position: { x: e.clientX - 300, y: e.clientY - 100 },
      data: { label: item.label, ...item.defaultData },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  /* 单节点运行 */
  const runSingleNode = useCallback(async (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const d = node.data as Record<string, unknown>;
    if (d._frozen) return;
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, _running: true } } : n));
    await sleep(800 + Math.random() * 600);
    const output = mockNodeOutput(node);
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, _running: false, _lastOutput: output } } : n));
  }, [nodes, setNodes]);

  /* 复制节点 */
  const duplicateNode = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const newNode: Node = {
      ...node,
      id: `${Date.now()}`,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      data: { ...node.data, label: `${(node.data as Record<string, unknown>).label} (副本)` },
      selected: false,
    };
    setNodes((nds) => [...nds, newNode]);
  }, [nodes, setNodes]);

  /* 冻结/解冻 */
  const toggleFreeze = useCallback((nodeId: string) => {
    setNodes((nds) => nds.map((n) => {
      if (n.id !== nodeId) return n;
      const d = n.data as Record<string, unknown>;
      return { ...n, data: { ...n.data, _frozen: !d._frozen } };
    }));
  }, [setNodes]);

  /* 删除节点 */
  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  }, [setNodes, setEdges, selectedNodeId]);

  /* 全流程调试运行 */
  const runDebug = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setDebugLogs([]);
    setRightTab("debug");
    const path = getExecutionPath(nodes, edges);
    for (const node of path) {
      const d = node.data as Record<string, unknown>;
      const color = NODE_COLOR_MAP[node.type ?? ""] || "#6366f1";
      const label = (d.label as string) || node.type || "";
      setDebugLogs((prev) => [...prev, { nodeId: node.id, label, type: node.type || "", color, status: "running" }]);
      setNodes((nds) => nds.map((n) => n.id === node.id ? { ...n, data: { ...n.data, _running: true } } : n));
      const start = Date.now();
      await sleep(600 + Math.random() * 800);
      const output = d._frozen ? ((d._lastOutput as string) || "(冻结 — 使用缓存输出)") : mockNodeOutput(node);
      const duration = Date.now() - start;
      setNodes((nds) => nds.map((n) => n.id === node.id ? { ...n, data: { ...n.data, _running: false, _lastOutput: output } } : n));
      setDebugLogs((prev) => prev.map((l) => l.nodeId === node.id ? { ...l, status: "done", output, duration } : l));
    }
    setIsRunning(false);
  }, [isRunning, nodes, edges, setNodes]);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      {/* 顶部导航 */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card/80 px-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/agent-flow/${agentId}`)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            返回编辑
          </button>
          <span className="text-xs text-muted-foreground/40">|</span>
          <span className="text-sm font-medium text-foreground">画布编排</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-secondary p-0.5">
          <button onClick={() => setSimpleMode(true)}
            className={cn("flex items-center gap-1.5 rounded-md px-3 py-1 text-xs transition-colors",
              simpleMode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <Settings2 className="h-3.5 w-3.5" />
            简单模式
          </button>
          <button onClick={() => setSimpleMode(false)}
            className={cn("flex items-center gap-1.5 rounded-md px-3 py-1 text-xs transition-colors",
              !simpleMode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <Workflow className="h-3.5 w-3.5" />
            编排模式
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* 左侧面板 — 节点列表 */}
        <div className="flex w-[220px] shrink-0 flex-col border-r border-border bg-card/50">
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">节点类型</p>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-1 p-2">
              {NODE_TYPES_LIST.map((item) => (
                <div key={item.type}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData("application/reactflow", item.type); e.dataTransfer.effectAllowed = "move"; }}
                  className="flex cursor-grab items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-secondary active:cursor-grabbing"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ backgroundColor: item.color + "20" }}>
                    <item.icon className="h-4 w-4" style={{ color: item.color }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground">{item.desc.slice(0, 15)}…</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="border-t border-border p-3">
            <Button onClick={runDebug} disabled={isRunning} size="sm"
              className="w-full gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20">
              {isRunning ? <><Square className="h-3.5 w-3.5" />运行中…</> : <><Play className="h-3.5 w-3.5" />运行调试</>}
            </Button>
          </div>
        </div>

        {/* 中间画布 */}
        <div className="relative min-w-0 flex-1" onDragOver={onDragOver} onDrop={onDrop}>
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            onNodeContextMenu={handleNodeContextMenu}
            fitView
            className="bg-background"
          >
            <Background gap={20} size={1} />
            <Controls className="!rounded-xl !border-border !bg-card !shadow-lg" />
            <MiniMap className="!rounded-xl !border-border !bg-card" nodeBorderRadius={8} />
          </ReactFlow>
          {contextMenu && (
            <NodeContextMenu
              menu={contextMenu}
              onClose={() => setContextMenu(null)}
              onRunSingle={runSingleNode}
              onDuplicate={duplicateNode}
              onToggleFreeze={toggleFreeze}
              onDelete={deleteNode}
              isFrozen={!!(nodes.find((n) => n.id === contextMenu.nodeId)?.data as Record<string, unknown>)?._frozen}
            />
          )}
        </div>

        {/* 右侧面板 */}
        <div className="flex w-[320px] shrink-0 flex-col border-l border-border bg-card/50">
          {/* Tab 切换 */}
          <div className="flex shrink-0 border-b border-border">
            {([
              { key: "guide", label: "学习", icon: GraduationCap },
              { key: "config", label: "配置", icon: Settings2 },
              { key: "debug", label: "调试", icon: Play },
            ] as const).map((tab) => (
              <button key={tab.key} onClick={() => setRightTab(tab.key)}
                className={cn("flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors",
                  rightTab === tab.key ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground")}>
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          <ScrollArea className="min-h-0 flex-1">
            {/* 学习 Tab */}
            {rightTab === "guide" && (
              <div className="flex flex-col gap-4 p-4">
                <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-400">
                    <GraduationCap className="h-4 w-4" />
                    什么是 Agent 编排？
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Agent 编排是将 AI 能力拆解为多个步骤，通过可视化流程图连接起来。
                    每个节点负责一个任务（理解意图、调用工具、生成回复），节点之间通过连线传递数据。
                  </p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <h3 className="mb-2 text-sm font-semibold text-foreground">🎯 试试这些操作</h3>
                  <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2"><ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />从左侧拖拽节点到画布</li>
                    <li className="flex items-start gap-2"><ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />点击节点查看配置和教学提示</li>
                    <li className="flex items-start gap-2"><ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />右键节点可以单独运行或冻结</li>
                    <li className="flex items-start gap-2"><ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />点击「运行调试」看完整流程执行</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <h3 className="mb-2 text-sm font-semibold text-foreground">📚 核心概念</h3>
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <p><span className="font-medium text-foreground">变量传递：</span>用 {"{{input}}"} 引用上游输出，实现节点间数据流动</p>
                    <p><span className="font-medium text-foreground">温度控制：</span>低温度（0-0.3）输出确定，高温度（0.7-1）输出多样</p>
                    <p><span className="font-medium text-foreground">冻结节点：</span>锁定输出不再重新执行，调试时节省时间</p>
                  </div>
                </div>
              </div>
            )}

            {/* 配置 Tab */}
            {rightTab === "config" && (
              selectedNode ? (
                <ConfigPanel node={selectedNode} setNodes={setNodes} />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Settings2 className="mb-3 h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">点击画布上的节点</p>
                  <p className="text-xs text-muted-foreground/60">查看和编辑节点配置</p>
                </div>
              )
            )}

            {/* 调试 Tab */}
            {rightTab === "debug" && (
              <div className="flex flex-col gap-2 p-4">
                {debugLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Play className="mb-3 h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">点击「运行调试」开始</p>
                    <p className="text-xs text-muted-foreground/60">将逐节点执行并显示输出</p>
                  </div>
                ) : (
                  debugLogs.map((log, i) => (
                    <div key={i} className="rounded-lg border border-border p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: log.color }} />
                        <span className="text-sm font-medium text-foreground">{log.label}</span>
                        <span className="text-[11px] text-muted-foreground">{log.type}</span>
                        {log.status === "running" && (
                          <span className="ml-auto text-[11px] text-orange-400 animate-pulse">执行中…</span>
                        )}
                        {log.status === "done" && log.duration && (
                          <span className="ml-auto text-[11px] text-muted-foreground">{log.duration}ms</span>
                        )}
                      </div>
                      {log.output && (
                        <div className="mt-2 rounded-md bg-secondary/50 px-3 py-2">
                          <p className="text-xs text-emerald-400">{log.output}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
