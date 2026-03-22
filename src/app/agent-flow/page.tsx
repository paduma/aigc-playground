"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  Copy,
  Clock,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type AgentConfig,
  createDemoAgents,
  createEmptyAgent,
} from "@/lib/agent-store";
import { cn } from "@/lib/utils";

function formatDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 172800000) return "昨天";
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

/* ── 智能体卡片 ── */
function AgentCard({
  agent,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  agent: AgentConfig;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const enabledTools = agent.tools.filter((t) => t.enabled);

  return (
    <div
      onClick={onEdit}
      className="group relative flex cursor-pointer flex-col rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
    >
      {/* 状态标签 */}
      <div className="absolute right-4 top-4">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-medium",
            agent.status === "published"
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-amber-500/10 text-amber-400"
          )}
        >
          {agent.status === "published" ? "已发布" : "草稿"}
        </span>
      </div>

      {/* 图标 + 名称 */}
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-2xl ring-1 ring-border">
          {agent.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground">{agent.name}</h3>
          <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {agent.description || "暂无描述"}
          </p>
        </div>
      </div>

      {/* 标签 */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
          {agent.model}
        </span>
        <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
          {agent.mode === "simple" ? "简单模式" : "编排模式"}
        </span>
        {enabledTools.slice(0, 2).map((t) => (
          <span key={t.id} className="rounded-md bg-primary/8 px-2 py-0.5 text-[11px] text-primary/80">
            {t.name}
          </span>
        ))}
        {enabledTools.length > 2 && (
          <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
            +{enabledTools.length - 2}
          </span>
        )}
      </div>

      {/* 底部信息 */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
          <Clock className="h-3 w-3" />
          {formatDate(agent.updatedAt)}
        </span>

        {/* 更多操作 */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="flex h-7 w-7 scale-0 items-center justify-center rounded-lg text-muted-foreground transition-all group-hover:scale-100 hover:bg-secondary hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
              <div className="absolute bottom-full right-0 z-50 mb-1 w-36 rounded-xl border border-border bg-popover p-1 shadow-xl shadow-black/20">
                <button
                  onClick={(e) => { e.stopPropagation(); onDuplicate(); setShowMenu(false); }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-secondary"
                >
                  <Copy className="h-3.5 w-3.5" /> 复制
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" /> 删除
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 主页面：智能体列表 ── */
export default function AgentListPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentConfig[]>(() => createDemoAgents());
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? agents.filter(
      (a) =>
        a.name.includes(search) ||
        a.description.includes(search)
    )
    : agents;

  const handleCreate = useCallback(() => {
    const newAgent = createEmptyAgent();
    setAgents((prev) => [newAgent, ...prev]);
    // 直接进入编辑页
    router.push(`/agent-flow/${newAgent.id}`);
  }, [router]);

  const handleDelete = useCallback((id: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleDuplicate = useCallback((agent: AgentConfig) => {
    const dup: AgentConfig = {
      ...agent,
      id: `agent-${Date.now()}`,
      name: agent.name + " (副本)",
      status: "draft",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setAgents((prev) => [dup, ...prev]);
  }, []);

  const publishedCount = agents.filter((a) => a.status === "published").length;
  const draftCount = agents.filter((a) => a.status === "draft").length;

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/20">
              <Workflow className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">智能体工作台</h1>
              <p className="text-sm text-muted-foreground">
                {publishedCount} 个已发布 · {draftCount} 个草稿
              </p>
            </div>
          </div>
          <Button onClick={handleCreate} className="gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
            <Plus className="h-4 w-4" />
            创建智能体
          </Button>
        </div>

        {/* 搜索 */}
        <div className="relative mt-4 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索智能体…"
            className="w-full rounded-xl border border-border bg-input py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
      </div>

      {/* 卡片网格 */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid grid-cols-1 gap-5 p-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {/* 创建卡片 */}
          <button
            onClick={handleCreate}
            className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card/30 text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary ring-1 ring-border">
              <Plus className="h-6 w-6" />
            </div>
            <span className="text-sm font-medium">创建智能体</span>
          </button>

          {filtered.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={() => router.push(`/agent-flow/${agent.id}`)}
              onDelete={() => handleDelete(agent.id)}
              onDuplicate={() => handleDuplicate(agent)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
