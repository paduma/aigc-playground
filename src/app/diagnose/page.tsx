"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Headset,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  ClipboardList,
  Info,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/* ══════════════════════════════════════════
   消息类型系统 — 对话式表单的核心
   text:     普通文本/markdown
   select:   单选卡片
   multi:    多选卡片
   form:     表单（输入框 + 下拉）
   confirm:  确认卡片（摘要 + 提交按钮）
   result:   最终结果卡片
   ══════════════════════════════════════════ */

interface SelectOption {
  id: string;
  label: string;
  desc?: string;
  icon?: string;
}

interface FormField {
  id: string;
  label: string;
  type: "text" | "select" | "textarea";
  placeholder?: string;
  options?: string[]; // for select type
  required?: boolean;
}

type CardType = "text" | "select" | "multi" | "form" | "confirm" | "result";

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  type: CardType;
  content: string;
  // card-specific data
  options?: SelectOption[];
  selectedIds?: string[];
  formFields?: FormField[];
  formValues?: Record<string, string>;
  confirmData?: { label: string; value: string }[];
  locked?: boolean; // 提交后锁定
  timestamp: number;
}

/* ── 对话流程定义 ── */
interface FlowStep {
  assistantMsg: Omit<ChatMessage, "id" | "role" | "timestamp" | "locked">;
  onSubmit: (data: Record<string, string> | string | string[]) => string; // 返回用户侧显示文本
}

const FLOW_STEPS: FlowStep[] = [
  // Step 0: 欢迎 + 选择问题类型
  {
    assistantMsg: {
      type: "select",
      content: "你好！我是 IT 服务台助手 🤖\n请选择你遇到的问题类型，我会引导你快速解决或提交工单。",
      options: [
        { id: "network", label: "网络问题", desc: "WiFi 断连、VPN 无法连接、网速慢", icon: "🌐" },
        { id: "software", label: "软件故障", desc: "应用崩溃、安装失败、许可证过期", icon: "💻" },
        { id: "hardware", label: "硬件问题", desc: "显示器、键盘、打印机等设备故障", icon: "🖥️" },
        { id: "account", label: "账号权限", desc: "密码重置、权限申请、账号解锁", icon: "🔑" },
      ],
    },
    onSubmit: (data) => {
      const labels: Record<string, string> = { network: "网络问题", software: "软件故障", hardware: "硬件问题", account: "账号权限" };
      return labels[data as string] || (data as string);
    },
  },
  // Step 1: 选择影响范围
  {
    assistantMsg: {
      type: "select",
      content: "了解了。这个问题影响了多少人？",
      options: [
        { id: "self", label: "仅我自己", icon: "👤" },
        { id: "team", label: "我的团队（2-10 人）", icon: "👥" },
        { id: "dept", label: "整个部门", icon: "🏢" },
        { id: "company", label: "全公司", icon: "🌍" },
      ],
    },
    onSubmit: (data) => {
      const labels: Record<string, string> = { self: "仅我自己", team: "我的团队", dept: "整个部门", company: "全公司" };
      return labels[data as string] || (data as string);
    },
  },
  // Step 2: 多选 — 已尝试的操作
  {
    assistantMsg: {
      type: "multi",
      content: "在提交工单前，请告诉我你已经尝试过哪些操作？（可多选）",
      options: [
        { id: "restart", label: "重启设备" },
        { id: "reconnect", label: "重新连接网络" },
        { id: "update", label: "更新软件/驱动" },
        { id: "clear_cache", label: "清除缓存" },
        { id: "none", label: "还没有尝试任何操作" },
      ],
    },
    onSubmit: (data) => {
      const ids = data as string[];
      if (ids.includes("none")) return "还没有尝试任何操作";
      const labels: Record<string, string> = { restart: "重启设备", reconnect: "重新连接网络", update: "更新软件/驱动", clear_cache: "清除缓存" };
      return ids.map((id) => labels[id] || id).join("、");
    },
  },
  // Step 3: 表单 — 详细信息
  {
    assistantMsg: {
      type: "form",
      content: "请补充以下信息，帮助技术人员更快定位问题：",
      formFields: [
        { id: "title", label: "问题简述", type: "text", placeholder: "用一句话描述你的问题", required: true },
        { id: "urgency", label: "紧急程度", type: "select", options: ["低 — 不影响工作", "中 — 部分功能受限", "高 — 完全无法工作", "紧急 — 影响业务运营"], required: true },
        { id: "detail", label: "详细描述", type: "textarea", placeholder: "什么时候开始的？有没有错误提示？" },
      ],
    },
    onSubmit: (data) => {
      const d = data as Record<string, string>;
      return d.title || "已填写详细信息";
    },
  },
  // Step 4: 确认卡片
  {
    assistantMsg: {
      type: "confirm",
      content: "请确认以下工单信息，确认无误后点击提交：",
      // confirmData 会在运行时动态填充
    },
    onSubmit: () => "确认提交",
  },
  // Step 5: 结果
  {
    assistantMsg: {
      type: "result",
      content: "🎉 工单已创建成功！\n\n工单编号：**IT-2026-0318-0042**\n预计响应时间：**30 分钟内**\n\n技术人员会通过企业微信联系你。如果问题紧急，也可以拨打 IT 热线 **8888**。\n\n> 这是演示模式。在实际产品中，这里会调用工单系统 API 创建真实工单，并通过 WebSocket 推送处理进度。",
    },
    onSubmit: () => "",
  },
];

/* ══════════════════════════════════════════
   卡片组件
   ══════════════════════════════════════════ */

/* 单选卡片 */
function SelectCard({
  options,
  selectedId,
  locked,
  onSelect,
}: {
  options: SelectOption[];
  selectedId?: string;
  locked?: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => !locked && onSelect(opt.id)}
          disabled={locked}
          className={cn(
            "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
            locked && selectedId === opt.id
              ? "border-primary/40 bg-primary/10"
              : locked
                ? "border-border bg-card/30 opacity-40"
                : selectedId === opt.id
                  ? "border-primary/40 bg-primary/10 ring-1 ring-primary/20"
                  : "border-border bg-card hover:border-primary/20 hover:bg-card/80"
          )}
        >
          {opt.icon && <span className="text-lg">{opt.icon}</span>}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{opt.label}</p>
            {opt.desc && <p className="mt-0.5 text-xs text-muted-foreground">{opt.desc}</p>}
          </div>
          {locked && selectedId === opt.id && (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
          )}
        </button>
      ))}
    </div>
  );
}

/* 多选卡片 */
function MultiSelectCard({
  options,
  selectedIds,
  locked,
  onToggle,
}: {
  options: SelectOption[];
  selectedIds: string[];
  locked?: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = selectedIds.includes(opt.id);
        return (
          <button
            key={opt.id}
            onClick={() => !locked && onToggle(opt.id)}
            disabled={locked}
            className={cn(
              "rounded-xl border px-4 py-2.5 text-sm transition-all",
              locked && selected
                ? "border-primary/40 bg-primary/10 text-primary"
                : locked
                  ? "border-border bg-card/30 text-muted-foreground/40"
                  : selected
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:border-primary/20"
            )}
          >
            {opt.label}
            {locked && selected && <CheckCircle2 className="ml-1.5 inline h-3.5 w-3.5" />}
          </button>
        );
      })}
    </div>
  );
}

/* 自定义下拉选择（暗色主题友好） */
function CustomFormSelect({
  value,
  options,
  placeholder,
  disabled,
  onChange,
}: {
  value: string;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // 打开时重置焦点到当前选中项
  useEffect(() => {
    if (open) {
      const idx = options.indexOf(value);
      setFocusIdx(idx >= 0 ? idx : 0);
    }
  }, [open, options, value]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setFocusIdx((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusIdx((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (focusIdx >= 0 && focusIdx < options.length) {
          onChange(options[focusIdx]);
          setOpen(false);
        }
        break;
    }
  }, [open, focusIdx, options, onChange]);

  return (
    <div ref={ref} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border border-border bg-input px-3 py-2.5 text-sm transition-colors disabled:opacity-50",
          value ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span className="truncate">{value || placeholder || "请选择"}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div role="listbox" className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-border bg-popover p-1 shadow-xl shadow-black/20">
          {options.map((opt, i) => (
            <button
              key={opt}
              role="option"
              aria-selected={value === opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={cn(
                "flex w-full items-center rounded-lg px-3 py-2 text-sm transition-colors",
                value === opt
                  ? "bg-primary/10 text-primary"
                  : i === focusIdx
                    ? "bg-secondary text-foreground"
                    : "text-foreground hover:bg-secondary"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* 表单卡片 */
function FormCard({
  fields,
  values,
  locked,
  onChange,
}: {
  fields: FormField[];
  values: Record<string, string>;
  locked?: boolean;
  onChange: (id: string, value: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-3">
      {fields.map((f) => (
        <div key={f.id}>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {f.label}
            {f.required && <span className="ml-0.5 text-rose-400">*</span>}
          </label>
          {f.type === "select" ? (
            <CustomFormSelect
              value={values[f.id] || ""}
              options={f.options || []}
              placeholder="请选择"
              disabled={locked}
              onChange={(v) => onChange(f.id, v)}
            />
          ) : f.type === "textarea" ? (
            <textarea
              value={values[f.id] || ""}
              onChange={(e) => onChange(f.id, e.target.value)}
              disabled={locked}
              rows={3}
              placeholder={f.placeholder}
              className="w-full resize-none rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-50"
            />
          ) : (
            <input
              value={values[f.id] || ""}
              onChange={(e) => onChange(f.id, e.target.value)}
              disabled={locked}
              placeholder={f.placeholder}
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-50"
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* 确认卡片 */
function ConfirmCard({ data, locked }: { data: { label: string; value: string }[]; locked?: boolean }) {
  return (
    <div className="mt-3 rounded-xl border border-border bg-card/60 p-4">
      <div className="flex flex-col gap-2">
        {data.map((item) => (
          <div key={item.label} className="flex items-start gap-2">
            <span className="w-20 shrink-0 text-xs text-muted-foreground">{item.label}</span>
            <span className="text-sm text-foreground">{item.value}</span>
          </div>
        ))}
      </div>
      {locked && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" /> 已提交
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   主页面
   ══════════════════════════════════════════ */

export default function DiagnosePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [typing, setTyping] = useState(false);
  // 当前交互状态（未提交的选择/表单值）
  const [pendingSelect, setPendingSelect] = useState<string>("");
  const [pendingMulti, setPendingMulti] = useState<string[]>([]);
  const [pendingForm, setPendingForm] = useState<Record<string, string>>({});
  // 收集的所有数据（用于确认卡片）
  const [collected, setCollected] = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const initRef = useRef(false);
  const [showTechPanel, setShowTechPanel] = useState(true);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" } as ScrollIntoViewOptions);
    });
  }, []);

  /* 推送下一步的 assistant 消息 */
  const pushAssistantMsg = useCallback((stepIdx: number, extraData?: Partial<ChatMessage>) => {
    setTyping(true);
    setTimeout(() => {
      const step = FLOW_STEPS[stepIdx];
      if (!step) return;
      const msg: ChatMessage = {
        id: `assistant-${stepIdx}`,
        role: "assistant",
        timestamp: Date.now(),
        ...step.assistantMsg,
        ...extraData,
      };
      setMessages((prev) => [...prev, msg]);
      setTyping(false);
      // 重置 pending 状态
      setPendingSelect("");
      setPendingMulti([]);
      setPendingForm({});
    }, 400 + Math.random() * 300);
  }, []);

  /* 初始化 */
  useEffect(() => {
    if (messages.length === 0 && !initRef.current) {
      initRef.current = true;
      pushAssistantMsg(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typing, scrollToBottom]);

  /* 提交当前步骤 */
  const submitStep = useCallback(() => {
    const step = FLOW_STEPS[currentStep];
    if (!step) return;

    let data: string | string[] | Record<string, string>;
    let userText: string;
    const msgType = step.assistantMsg.type;

    if (msgType === "select") {
      if (!pendingSelect) return;
      data = pendingSelect;
      userText = step.onSubmit(data);
    } else if (msgType === "multi") {
      if (pendingMulti.length === 0) return;
      data = pendingMulti;
      userText = step.onSubmit(data);
    } else if (msgType === "form") {
      // 检查必填
      const missing = step.assistantMsg.formFields?.filter(
        (f) => f.required && !pendingForm[f.id]?.trim()
      );
      if (missing && missing.length > 0) return;
      data = pendingForm;
      userText = step.onSubmit(data);
    } else if (msgType === "confirm") {
      data = "confirm";
      userText = step.onSubmit(data);
    } else {
      return;
    }

    // 锁定当前 assistant 消息
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== `assistant-${currentStep}`) return m;
        return {
          ...m,
          locked: true,
          selectedIds: msgType === "select" ? [pendingSelect] : msgType === "multi" ? [...pendingMulti] : m.selectedIds,
          formValues: msgType === "form" ? { ...pendingForm } : m.formValues,
        };
      })
    );

    // 添加用户消息
    const userMsg: ChatMessage = {
      id: `user-${currentStep}`,
      role: "user",
      type: "text",
      content: userText,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // 收集数据
    const newCollected = { ...collected };
    if (currentStep === 0) newCollected["问题类型"] = userText;
    if (currentStep === 1) newCollected["影响范围"] = userText;
    if (currentStep === 2) newCollected["已尝试操作"] = userText;
    if (currentStep === 3 && typeof data === "object" && !Array.isArray(data)) {
      newCollected["问题简述"] = data.title || "";
      newCollected["紧急程度"] = data.urgency || "";
      if (data.detail) newCollected["详细描述"] = data.detail;
    }
    setCollected(newCollected);

    // 推送下一步
    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);

    if (nextStep < FLOW_STEPS.length) {
      // 确认卡片需要动态填充 confirmData
      if (FLOW_STEPS[nextStep].assistantMsg.type === "confirm") {
        const confirmData = Object.entries(newCollected).map(([label, value]) => ({ label, value }));
        pushAssistantMsg(nextStep, { confirmData });
      } else {
        pushAssistantMsg(nextStep);
      }
    }
  }, [currentStep, pendingSelect, pendingMulti, pendingForm, collected, pushAssistantMsg]);

  /* 重新开始 */
  const restart = useCallback(() => {
    setMessages([]);
    setCurrentStep(0);
    setCollected({});
    setPendingSelect("");
    setPendingMulti([]);
    setPendingForm({});
    initRef.current = true; // 防止 effect 再次触发
    setTimeout(() => pushAssistantMsg(0), 100);
  }, [pushAssistantMsg]);

  /* 多选 toggle */
  const toggleMulti = useCallback((id: string) => {
    setPendingMulti((prev) => {
      if (id === "none") return ["none"];
      const without = prev.filter((x) => x !== "none");
      return without.includes(id) ? without.filter((x) => x !== id) : [...without, id];
    });
  }, []);

  const isLastStep = currentStep >= FLOW_STEPS.length - 1;
  const currentMsgType = FLOW_STEPS[currentStep]?.assistantMsg.type;
  const canSubmit =
    currentMsgType === "select" ? !!pendingSelect :
      currentMsgType === "multi" ? pendingMulti.length > 0 :
        currentMsgType === "form" ? FLOW_STEPS[currentStep]?.assistantMsg.formFields?.filter((f) => f.required).every((f) => pendingForm[f.id]?.trim()) :
          currentMsgType === "confirm" ? true :
            false;

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-md shadow-cyan-500/20">
              <Headset className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">IT 服务台助手</h1>
              <p className="text-sm text-muted-foreground">对话式表单 · Interactive Cards · 结构化信息收集</p>
            </div>
          </div>
          <Button variant="outline" onClick={restart} className="gap-2">
            <RotateCcw className="h-3.5 w-3.5" />
            重新开始
          </Button>
        </div>
      </div>

      {/* 对话区 */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn("msg-enter", msg.role === "user" ? "flex justify-end" : "flex justify-start")}
            >
              {msg.role === "user" ? (
                <div className="max-w-[75%] rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm text-white">
                  {msg.content}
                </div>
              ) : (
                <div className="max-w-[85%] rounded-2xl bg-card px-5 py-4 ring-1 ring-border">
                  {/* 文本内容 */}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{msg.content}</p>

                  {/* 单选 */}
                  {msg.type === "select" && msg.options && (
                    <SelectCard
                      options={msg.options}
                      selectedId={msg.locked ? msg.selectedIds?.[0] : pendingSelect}
                      locked={msg.locked}
                      onSelect={setPendingSelect}
                    />
                  )}

                  {/* 多选 */}
                  {msg.type === "multi" && msg.options && (
                    <MultiSelectCard
                      options={msg.options}
                      selectedIds={msg.locked ? msg.selectedIds || [] : pendingMulti}
                      locked={msg.locked}
                      onToggle={toggleMulti}
                    />
                  )}

                  {/* 表单 */}
                  {msg.type === "form" && msg.formFields && (
                    <FormCard
                      fields={msg.formFields}
                      values={msg.locked ? msg.formValues || {} : pendingForm}
                      locked={msg.locked}
                      onChange={(id, val) => setPendingForm((prev) => ({ ...prev, [id]: val }))}
                    />
                  )}

                  {/* 确认 */}
                  {msg.type === "confirm" && msg.confirmData && (
                    <ConfirmCard data={msg.confirmData} locked={msg.locked} />
                  )}

                  {/* 结果 */}
                  {msg.type === "result" && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      工单已创建
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* 打字指示器 */}
          {typing && (
            <div className="flex justify-start">
              <div className="flex gap-1.5 rounded-2xl bg-card px-5 py-4 ring-1 ring-border">
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* 底部操作栏 */}
      {!isLastStep && messages.length > 0 && !typing && (
        <div className="shrink-0 border-t border-border px-6 py-4">
          <div className="mx-auto flex max-w-2xl items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ClipboardList className="h-3.5 w-3.5" />
              步骤 {currentStep + 1} / {FLOW_STEPS.length - 1}
            </div>
            <Button
              onClick={submitStep}
              disabled={!canSubmit}
              className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600"
            >
              {currentMsgType === "confirm" ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  确认提交
                </>
              ) : (
                <>
                  下一步
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* 技术说明 — 右下角浮动，可收起/展开 */}
      {showTechPanel ? (
        <div className="absolute bottom-4 right-4 w-[240px] rounded-xl border border-border bg-card/90 p-4 shadow-xl backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">💡 前端技术要点</p>
            <button onClick={() => setShowTechPanel(false)}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-secondary hover:text-foreground"
              title="收起">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ul className="space-y-1 text-[11px] leading-relaxed text-muted-foreground/80">
            <li>• 消息类型系统：text / select / multi / form / confirm / result</li>
            <li>• 表单提交后锁定为只读历史</li>
            <li>• 流程状态机驱动对话推进</li>
            <li>• 类似 Coze Bot / 钉钉 AI 的卡片交互</li>
          </ul>
        </div>
      ) : (
        <button onClick={() => setShowTechPanel(true)}
          className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/90 text-muted-foreground shadow-lg backdrop-blur-sm transition-colors hover:bg-secondary hover:text-foreground"
          title="显示技术要点">
          <Info className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
