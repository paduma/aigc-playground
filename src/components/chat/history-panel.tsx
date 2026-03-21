"use client";

import { Plus, Clock, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type ChatSession } from "@/lib/chat-store";
import { formatDate } from "@/lib/chat-utils";
import { cn } from "@/lib/utils";

export function HistoryPanel({
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  sessions: ChatSession[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex h-full w-[260px] shrink-0 flex-col border-r border-border bg-card/50">
      {/* 新建对话按钮 */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3.5">
        <span className="text-sm font-medium text-foreground">对话历史</span>
        <button
          onClick={onNew}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          title="新建对话"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* 对话列表 */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={cn(
                "group relative flex w-full cursor-pointer flex-col items-start rounded-lg px-3 py-2.5 text-left transition-all duration-150",
                s.id === activeId
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              {s.id === activeId && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <span className="w-full truncate text-sm">{s.title}</span>
              <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground/60">
                <Clock className="h-3 w-3" />
                {formatDate(s.createdAt)}
                <span className="ml-1">{s.messages.length} 条</span>
              </span>
              {/* 删除按钮 */}
              {sessions.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 scale-0 items-center justify-center rounded-md text-muted-foreground transition-all group-hover:scale-100 hover:bg-destructive/15 hover:text-destructive"
                  title="删除对话"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
