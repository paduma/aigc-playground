"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Paperclip, Mic, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODELS } from "@/lib/chat-utils";

export function ChatToolbar({
  model,
  onModelChange,
  webSearch,
  onWebSearchChange,
  isListening,
  onVoiceToggle,
  voiceSupported,
  onAttach,
  pendingCount,
}: {
  model: string;
  onModelChange: (id: string) => void;
  webSearch: boolean;
  onWebSearchChange: (v: boolean) => void;
  isListening: boolean;
  onVoiceToggle: () => void;
  voiceSupported: boolean;
  onAttach: () => void;
  pendingCount: number;
}) {
  const [showModelMenu, setShowModelMenu] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const currentModel = MODELS.find((m) => m.id === model) ?? MODELS[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setShowModelMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="flex shrink-0 items-center gap-1 px-1 pb-2">
      {/* 模型选择 */}
      <div ref={modelMenuRef} className="relative">
        <button
          onClick={() => setShowModelMenu(!showModelMenu)}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <span className="font-medium">{currentModel.name}</span>
          <ChevronDown className={cn("h-3 w-3 transition-transform", showModelMenu && "rotate-180")} />
        </button>
        {showModelMenu && (
          <div className="absolute bottom-full left-0 z-50 mb-1 w-56 rounded-xl border border-border bg-popover p-1.5 shadow-xl shadow-black/20">
            <p className="px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">选择模型</p>
            {MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => { onModelChange(m.id); setShowModelMenu(false); }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                  m.id === model
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-secondary"
                )}
              >
                <span>{m.name}</span>
                <span className="text-[11px] text-muted-foreground/60">{m.provider}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <span className="text-border">·</span>

      {/* 附件 */}
      <button
        onClick={onAttach}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
          pendingCount > 0
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        )}
        title="上传图片或文件"
      >
        <Paperclip className="h-3.5 w-3.5" />
        <span>附件{pendingCount > 0 ? ` (${pendingCount})` : ""}</span>
      </button>

      <span className="text-border">·</span>

      {/* 语音输入 */}
      <button
        onClick={onVoiceToggle}
        disabled={!voiceSupported}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
          isListening
            ? "bg-red-500/15 text-red-400 animate-pulse"
            : voiceSupported
              ? "text-muted-foreground hover:bg-secondary hover:text-foreground"
              : "text-muted-foreground/40 cursor-not-allowed"
        )}
        title={voiceSupported ? (isListening ? "停止录音" : "语音输入") : "浏览器不支持语音识别"}
      >
        <Mic className="h-3.5 w-3.5" />
        <span>{isListening ? "停止" : "语音"}</span>
      </button>

      <span className="text-border">·</span>

      {/* 联网搜索 */}
      <button
        onClick={() => onWebSearchChange(!webSearch)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
          webSearch
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        )}
        title="联网搜索"
      >
        <Globe className="h-3.5 w-3.5" />
        <span>联网</span>
      </button>
    </div>
  );
}
