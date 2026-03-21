"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Send,
  Bot,
  User,
  Sparkles,
  Trash2,
  Square,
  Code2,
  FileText,
  Zap,
  X,
  Paperclip,
  ImageIcon,
  FileSpreadsheet,
  FileCode,
  RefreshCw,
  BarChart3,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { mockSSEStream, getReply, type ChatMessage } from "@/lib/mock-sse";
import { useVoiceInput } from "@/lib/use-voice-input";
import {
  type ChatSession,
  type ChatMessage as StoreMessage,
  createDemoSessions,
  createEmptySession,
  extractTitle,
} from "@/lib/chat-store";
import { cn } from "@/lib/utils";
import {
  type Attachment,
  type Message,
  formatTime,
  formatSize,
  getFileIconName,
  estimateTokens,
  processFile,
  getMultimodalReply,
  genMsgId,
} from "@/lib/chat-utils";
import { HoverCopyButton } from "@/components/chat/hover-copy-button";
import { MarkdownContent } from "@/components/chat/markdown-content";
import { ChatToolbar } from "@/components/chat/chat-toolbar";
import { HistoryPanel } from "@/components/chat/history-panel";
import { EChartBubble, parseChartBlocks, ChartSkeleton, parseStreamingSegments } from "@/components/chat/echart-bubble";

const quickPrompts = [
  { label: "写一段代码", value: "请写一段 React Hook 的代码示例", icon: Code2 },
  { label: "数据分析报告", value: "帮我分析一下 Q1 季度的销售数据", icon: BarChart3 },
  { label: "Markdown 演示", value: "展示一下 Markdown 渲染效果", icon: FileText },
  { label: "性能优化建议", value: "React 项目有哪些常见的性能优化手段？", icon: Zap },
];

const FILE_ICON_MAP: Record<string, typeof FileText> = {
  ImageIcon, FileSpreadsheet, FileCode, FileText,
};

function getFileIcon(name: string) {
  return FILE_ICON_MAP[getFileIconName(name)] || FileText;
}

/** 自动增高 textarea，最多 4 行 */
function useAutoResize(ref: React.RefObject<HTMLTextAreaElement | null>, value: string) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "50px";
    const maxH = 120;
    const scrollH = el.scrollHeight;
    el.style.height = Math.max(50, Math.min(scrollH, maxH)) + "px";
    el.style.overflowY = scrollH > maxH ? "auto" : "hidden";
  }, [ref, value]);
}

/* ── 主页面 ── */
export default function ChatPage() {
  // 多会话状态
  const [sessions, setSessions] = useState<ChatSession[]>(() => createDemoSessions());
  const [activeId, setActiveId] = useState<string>(() => sessions[0]?.id ?? "");

  // 当前会话的消息
  const activeSession = sessions.find((s) => s.id === activeId);
  const [messages, setMessages] = useState<Message[]>(
    () => (activeSession?.messages ?? []) as Message[]
  );

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [model, setModel] = useState("gpt-4o");
  const [webSearch, setWebSearch] = useState(false);

  // 语音输入
  const voice = useVoiceInput({
    onResult: (text) => setInput((prev) => prev + text),
  });
  const handleVoiceToggle = useCallback(() => {
    if (voice.isListening) voice.stop();
    else voice.start();
  }, [voice]);

  // 附件相关状态
  const [pendingFiles, setPendingFiles] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  const handleAttachClick = useCallback(() => {
    fileInputRef2.current?.click();
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAtts = await Promise.all(Array.from(files).map(processFile));
    setPendingFiles((prev) => [...prev, ...newAtts]);
    e.target.value = "";
  }, []);

  const removePendingFile = useCallback((idx: number) => {
    setPendingFiles((prev) => {
      const att = prev[idx];
      if (att.preview && att.type === "image") URL.revokeObjectURL(att.preview);
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  // 拖拽处理
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (!files.length) return;
    const newAtts = await Promise.all(Array.from(files).map(processFile));
    setPendingFiles((prev) => [...prev, ...newAtts]);
  }, []);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const activeIdRef = useRef(activeId);
  const isNearBottomRef = useRef(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  useAutoResize(inputRef, input);

  // 切换会话
  const switchSession = useCallback((id: string) => {
    if (id === activeId) return;
    setSessions((prev) => {
      const updated = prev.map((s) =>
        s.id === activeId ? { ...s, messages: messages as StoreMessage[] } : s
      );
      const target = updated.find((s) => s.id === id);
      if (target) setMessages(target.messages as Message[]);
      return updated;
    });
    setActiveId(id);
  }, [activeId, messages]);

  const handleNewSession = useCallback(() => {
    if (isStreaming) return;
    setSessions((prev) =>
      prev.map((s) => (s.id === activeId ? { ...s, messages: messages as StoreMessage[] } : s))
    );
    const newSession = createEmptySession();
    setSessions((prev) => [newSession, ...prev]);
    setActiveId(newSession.id);
    setMessages([]);
    setInput("");
  }, [activeId, messages, isStreaming]);

  const handleDeleteSession = useCallback((id: string) => {
    if (isStreaming) return;
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (id === activeId && next.length > 0) {
        setActiveId(next[0].id);
        setMessages(next[0].messages as Message[]);
      }
      return next;
    });
  }, [activeId, isStreaming]);

  const scrollToBottom = useCallback((mode: "smooth" | "instant") => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({
        behavior: mode === "smooth" ? "smooth" : "instant",
        block: "end",
      });
    });
  }, []);

  // 监听滚动容器，判断用户是否在底部附近
  useEffect(() => {
    const root = scrollAreaRef.current;
    if (!root) return;
    const viewport = root.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement | null;
    if (!viewport) return;
    const onScroll = () => {
      const gap = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      isNearBottomRef.current = gap < 80;
      setShowScrollBtn(gap > 200);
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
  }, []);

  // 流式输出：只在用户处于底部附近时才跟随
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return;
    if (lastMsg.streaming && lastMsg.content.length > 0 && isNearBottomRef.current) {
      scrollToBottom("instant");
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!isStreaming) inputRef.current?.focus();
  }, [isStreaming]);

  // 切换会话时滚动到底部
  useEffect(() => {
    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) bottomRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
      });
    });
    return () => { cancelled = true; };
  }, [activeId]);

  // 组件卸载时取消流式输出
  useEffect(() => {
    return () => { cancelRef.current?.(); };
  }, []);

  const syncToSessions = useCallback((msgs: Message[]) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeIdRef.current) return s;
        const title = msgs.length > 0 ? extractTitle(msgs as StoreMessage[]) : s.title;
        return { ...s, messages: msgs as StoreMessage[], title };
      })
    );
  }, []);

  const sendMessage = useCallback(
    (text: string) => {
      const hasAttachments = pendingFiles.length > 0;
      if (!text.trim() && !hasAttachments) return;
      if (isStreaming) return;
      const now = Date.now();
      const userAttachments = hasAttachments ? [...pendingFiles] : undefined;
      setMessages((prev) => [
        ...prev,
        { id: genMsgId(), role: "user", content: text.trim(), timestamp: now, attachments: userAttachments },
        { id: genMsgId(), role: "assistant", content: "", streaming: true, timestamp: now },
      ]);
      setInput("");
      setPendingFiles([]);
      setIsStreaming(true);
      isNearBottomRef.current = true; // 发送新消息时恢复自动滚动
      setTimeout(() => scrollToBottom("smooth"), 50);

      const history: ChatMessage[] = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: text.trim() },
      ];
      const reply = hasAttachments && userAttachments
        ? getMultimodalReply(text.trim(), userAttachments)
        : getReply(text, history);
      cancelRef.current = mockSSEStream(
        reply,
        (chunk) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") {
              updated[updated.length - 1] = { ...last, content: last.content + chunk };
            }
            return updated;
          });
        },
        () => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") {
              updated[updated.length - 1] = { ...last, streaming: false, timestamp: Date.now() };
            }
            syncToSessions(updated);
            return updated;
          });
          setIsStreaming(false);
          cancelRef.current = null;
        },
      );
    },
    [isStreaming, messages, syncToSessions, scrollToBottom, pendingFiles],
  );

  const handleStop = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last?.role === "assistant" && last.streaming) {
        updated[updated.length - 1] = { ...last, streaming: false, timestamp: Date.now() };
      }
      return updated;
    });
    setIsStreaming(false);
  }, []);

  const handleClear = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setMessages([]);
    setIsStreaming(false);
    syncToSessions([]);
  }, [syncToSessions]);

  const handleRegenerate = useCallback(() => {
    if (isStreaming) return;
    // Find the last user message
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === "user");
    if (lastUserIdx === -1) return;
    const realIdx = messages.length - 1 - lastUserIdx;
    const lastUserMsg = messages[realIdx];
    // Remove the last assistant message and regenerate
    const trimmed = messages.slice(0, realIdx + 1);
    setMessages([...trimmed, { id: genMsgId(), role: "assistant", content: "", streaming: true, timestamp: Date.now() }]);
    setIsStreaming(true);
    setTimeout(() => scrollToBottom("smooth"), 50);

    const history: ChatMessage[] = trimmed.map((m) => ({ role: m.role, content: m.content }));
    const reply = getReply(lastUserMsg.content, history);
    cancelRef.current = mockSSEStream(
      reply,
      (chunk) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
            updated[updated.length - 1] = { ...last, content: last.content + chunk };
          }
          return updated;
        });
      },
      () => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
            updated[updated.length - 1] = { ...last, streaming: false, timestamp: Date.now() };
          }
          syncToSessions(updated);
          return updated;
        });
        setIsStreaming(false);
        cancelRef.current = null;
      },
    );
  }, [isStreaming, messages, syncToSessions, scrollToBottom]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const totalTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  const msgCount = messages.filter((m) => !m.streaming).length;

  return (
    <div className="absolute inset-0 flex overflow-hidden">
      <HistoryPanel
        sessions={sessions}
        activeId={activeId}
        onSelect={switchSession}
        onNew={handleNewSession}
        onDelete={handleDeleteSession}
      />

      <div className="flex min-h-0 flex-1 flex-col px-6 pt-6 pb-4">
        {/* Header */}
        <div className="mb-5 flex shrink-0 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/20">
              <Sparkles className="h-[18px] w-[18px] text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">AI 对话</h1>
              <p className="text-sm text-muted-foreground">多模态 · SSE 流式 · Markdown · 代码高亮</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {msgCount > 0 && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground/60">
                <span>{msgCount} 条消息</span>
                <span>~{totalTokens} tokens</span>
              </div>
            )}
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClear} className="gap-1.5 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
                清空
              </Button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="relative min-h-0 flex-1">
          <ScrollArea
            ref={scrollAreaRef}
            className="h-full rounded-xl border border-border bg-card px-1"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isDragging && (
              <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-primary/50 bg-primary/5">
                <div className="flex flex-col items-center gap-2 text-primary">
                  <Paperclip className="h-10 w-10" />
                  <p className="text-sm font-medium">释放文件以上传</p>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-6 p-5">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-violet-500/15 ring-1 ring-indigo-500/25">
                    <Bot className="h-8 w-8 text-indigo-400" />
                  </div>
                  <p className="text-base text-foreground/80">你好，有什么可以帮你的？</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">选择下方话题快速开始，或直接输入你的问题</p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                    {quickPrompts.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => sendMessage(p.value)}
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-2 text-sm text-secondary-foreground transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                      >
                        <p.icon className="h-3.5 w-3.5" />
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={cn("msg-enter flex gap-3", isUser && "flex-row-reverse")}
                    style={{ animationDelay: `${Math.min(idx * 30, 200)}ms` }}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        isUser
                          ? "bg-gradient-to-br from-indigo-500 to-violet-600"
                          : "bg-card ring-1 ring-border"
                      )}
                    >
                      {isUser ? (
                        <User className="h-[18px] w-[18px] text-white" />
                      ) : (
                        <Bot className="h-[18px] w-[18px] text-muted-foreground" />
                      )}
                    </div>

                    <div className={cn("max-w-[78%]", isUser && "text-right")}>
                      <div className="group relative inline-block">
                        <div
                          className={cn(
                            "rounded-2xl px-5 py-3.5 text-[15px] leading-[1.8]",
                            isUser
                              ? "rounded-tr-md bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
                              : "min-h-[2.5rem] rounded-tl-md bg-secondary text-secondary-foreground ring-1 ring-border"
                          )}
                        >
                          {isUser ? (
                            <>
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div className="mb-2 flex flex-wrap gap-2">
                                  {msg.attachments.map((att, aIdx) => (
                                    <div key={aIdx}>
                                      {att.type === "image" ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={att.preview} alt={att.name} className="h-20 w-28 rounded-lg object-cover ring-1 ring-white/20" />
                                      ) : (
                                        <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5">
                                          {(() => { const Icon = getFileIcon(att.name); return <Icon className="h-4 w-4 text-white/70" />; })()}
                                          <div className="text-left">
                                            <div className="text-xs text-white/90">{att.name}</div>
                                            <div className="text-[10px] text-white/50">{formatSize(att.size)}</div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {msg.content && <p className="whitespace-pre-wrap text-left">{msg.content}</p>}
                            </>
                          ) : (
                            <>
                              {(() => {
                                // 流式输出中：渐进式渲染 — 已闭合的图表立即渲染，未闭合的显示骨架
                                if (msg.streaming) {
                                  const segs = parseStreamingSegments(msg.content);
                                  const hasRich = segs.some((s) => s.type === "skeleton" || s.type === "chart");
                                  if (!hasRich) {
                                    return <MarkdownContent content={msg.content} streaming />;
                                  }
                                  return segs.map((seg, si) =>
                                    seg.type === "text" ? (
                                      <MarkdownContent key={`t-${si}`} content={seg.value} streaming />
                                    ) : seg.type === "chart" ? (
                                      <EChartBubble key={`c-${si}`} option={seg.option} height={seg.height} />
                                    ) : (
                                      <ChartSkeleton key={`sk-${si}`} />
                                    )
                                  );
                                }
                                // 流式结束：解析并渲染图表
                                const { segments } = parseChartBlocks(msg.content);
                                const hasCharts = segments.some((s) => s.type === "chart");
                                if (!hasCharts) {
                                  return <MarkdownContent content={msg.content} streaming={false} />;
                                }
                                return segments.map((seg, si) =>
                                  seg.type === "text" ? (
                                    <MarkdownContent key={`t-${si}`} content={seg.value} streaming={false} />
                                  ) : (
                                    <EChartBubble key={`c-${si}`} option={seg.option} height={seg.height} />
                                  )
                                );
                              })()}
                              {msg.streaming && (
                                <span className="mt-1 inline-flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:0ms]" />
                                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:150ms]" />
                                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:300ms]" />
                                </span>
                              )}
                            </>
                          )}
                        </div>
                        {!msg.streaming && (
                          <HoverCopyButton text={msg.content} position={isUser ? "left" : "right"} />
                        )}
                      </div>
                      <div className={cn("mt-1.5 text-xs text-muted-foreground/60", isUser && "text-right")}>
                        {formatTime(msg.timestamp)}
                      </div>
                      {!isUser && !msg.streaming && idx === messages.length - 1 && !isStreaming && (
                        <button
                          onClick={handleRegenerate}
                          className="mt-1.5 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground/60 transition-colors hover:bg-secondary hover:text-foreground"
                          title="重新生成"
                        >
                          <RefreshCw className="h-3 w-3" />
                          重新生成
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} className="h-4 shrink-0" />
            </div>
          </ScrollArea>
          {showScrollBtn && (
            <button onClick={() => { isNearBottomRef.current = true; scrollToBottom("smooth"); }}
              className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs text-muted-foreground shadow-lg backdrop-blur transition-colors hover:text-foreground">
              <ArrowDown className="h-3 w-3" /> 回到底部
            </button>
          )}
        </div>

        {/* Toolbar + Input */}
        <div className="mt-4 mb-1 shrink-0">
          <ChatToolbar
            model={model}
            onModelChange={setModel}
            webSearch={webSearch}
            onWebSearchChange={setWebSearch}
            isListening={voice.isListening}
            onVoiceToggle={handleVoiceToggle}
            voiceSupported={voice.supported}
            onAttach={handleAttachClick}
            pendingCount={pendingFiles.length}
          />
          <input
            ref={fileInputRef2}
            type="file"
            multiple
            accept="image/*,.pdf,.txt,.md,.json,.csv,.doc,.docx,.js,.ts,.tsx,.jsx,.py"
            className="hidden"
            onChange={handleFileSelect}
          />
          {pendingFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2 rounded-lg border border-border bg-secondary/50 p-2">
              {pendingFiles.map((att, idx) => (
                <div key={idx} className="group/att relative">
                  {att.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={att.preview} alt={att.name} className="h-16 w-22 rounded-lg object-cover ring-1 ring-white/10" />
                  ) : (
                    <div className="flex h-16 w-22 flex-col items-center justify-center gap-0.5 rounded-lg bg-card ring-1 ring-border">
                      {(() => { const Icon = getFileIcon(att.name); return <Icon className="h-5 w-5 text-muted-foreground" />; })()}
                      <span className="max-w-[80px] truncate text-[10px] text-muted-foreground">{att.name}</span>
                      <span className="text-[9px] text-muted-foreground/50">{formatSize(att.size)}</span>
                    </div>
                  )}
                  <button
                    onClick={() => removePendingFile(idx)}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 scale-0 items-center justify-center rounded-full bg-destructive text-white shadow-md transition-transform group-hover/att:scale-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-3">
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入消息… Shift+Enter 换行"
                disabled={isStreaming || voice.isListening}
                rows={1}
                className={cn(
                  "block min-h-[50px] w-full resize-none rounded-xl border border-border bg-input px-4 py-3 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50",
                  voice.isListening && "border-red-500/40 ring-2 ring-red-500/20"
                )}
              />
              {voice.isListening && (
                <div className="absolute inset-0 flex items-center gap-3 rounded-xl bg-card/95 px-4">
                  <div className="flex items-center gap-[3px]">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className="inline-block w-[3px] rounded-full bg-red-400 animate-pulse"
                        style={{
                          height: `${12 + (voice.spectrum ? (voice.spectrum[i * 8] ?? 0) / 255 * 24 : [8, 16, 12, 20, 10][i])}px`,
                          animationDelay: `${i * 100}ms`,
                          animationDuration: "0.6s",
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {voice.interimText || "正在听…"}
                  </span>
                </div>
              )}
            </div>
            {isStreaming ? (
              <Button
                onClick={handleStop}
                size="icon"
                variant="outline"
                className="h-[50px] w-[50px] shrink-0 rounded-xl border-destructive/50 text-destructive hover:bg-destructive/10"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() && pendingFiles.length === 0}
                size="icon"
                className="h-[50px] w-[50px] shrink-0 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30 disabled:opacity-40 disabled:shadow-none"
              >
                <Send className="h-5 w-5" />
              </Button>
            )}
          </div>
          {voice.error && (
            <p className="mt-1.5 text-xs text-red-400">{voice.error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
