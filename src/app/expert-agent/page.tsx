"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ArrowDown, BarChart3, Send, Sparkles, TrendingUp, TrendingDown, Minus, Square, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { mockSSEStream } from "@/lib/mock-sse";
import { MarkdownContent } from "@/components/chat/markdown-content";
import { EChartBubble, parseChartBlocks, parseStreamingSegments, ChartSkeleton } from "@/components/chat/echart-bubble";

/* ── 模拟数据 ── */
const METRICS = [
  { label: "日活用户", value: "12.8 万", change: +5.2, unit: "DAU", query: "分析最近 7 天的日活用户趋势" },
  { label: "转化率", value: "3.2%", change: -0.4, unit: "CVR", query: "分析最近 7 天的转化率趋势" },
  { label: "客单价", value: "¥186", change: +12, unit: "ARPU", query: "分析客单价变化和影响因素" },
  { label: "ROI", value: "2.8", change: +0.3, unit: "", query: "哪个渠道的 ROI 最高？" },
];

const PRESET_QUESTIONS = [
  "分析最近 7 天的转化率趋势",
  "哪个渠道的 ROI 最高？",
  "用户流失的主要原因是什么？",
  "给出本周投放优化建议",
  "分析核心用户画像",
];

interface Message { role: "user" | "assistant"; content: string; timestamp: number; streaming?: boolean }

function getMockReply(input: string): string {
  if (input.includes("转化率")) {
    return "## 转化率趋势分析\n\n```sql\nSELECT date, channel, clicks, conversions,\n       ROUND(conversions * 100.0 / clicks, 2) AS cvr\nFROM ad_performance\nWHERE date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)\nORDER BY date DESC\n```\n\n**分析结果：**\n\n| 日期 | 渠道 | 点击 | 转化 | CVR |\n|------|------|------|------|-----|\n| 3/18 | 信息流 | 8,420 | 285 | 3.38% |\n| 3/17 | 信息流 | 7,890 | 241 | 3.05% |\n| 3/16 | 搜索 | 5,230 | 198 | 3.79% |\n\n<!--chart\n{\"title\":{\"text\":\"7 日转化率趋势\"},\"legend\":{\"top\":28},\"xAxis\":{\"type\":\"category\",\"data\":[\"3/12\",\"3/13\",\"3/14\",\"3/15\",\"3/16\",\"3/17\",\"3/18\"]},\"yAxis\":{\"type\":\"value\",\"name\":\"CVR %\",\"min\":2.5,\"max\":4},\"series\":[{\"name\":\"信息流\",\"type\":\"line\",\"data\":[3.12,3.25,3.18,3.31,3.42,3.05,3.38],\"smooth\":true},{\"name\":\"搜索\",\"type\":\"line\",\"data\":[3.65,3.58,3.72,3.81,3.79,3.68,3.75],\"smooth\":true}]}\n-->\n\n**诊断：** 信息流渠道 CVR 波动较大（3.05%~3.38%），搜索渠道相对稳定。建议检查 3/17 的落地页加载速度，可能存在性能问题导致转化下降。";
  }
  if (input.includes("ROI") || input.includes("渠道")) {
    return "## 渠道 ROI 对比\n\n| 渠道 | 花费 | 收入 | ROI |\n|------|------|------|-----|\n| 搜索广告 | ¥45,000 | ¥158,000 | **3.51** ✅ |\n| 信息流 | ¥82,000 | ¥213,000 | 2.60 |\n| 短视频 | ¥35,000 | ¥72,000 | 2.06 |\n| 社交媒体 | ¥18,000 | ¥28,000 | 1.56 ⚠️ |\n\n<!--chart\n{\"title\":{\"text\":\"渠道 ROI 对比\"},\"xAxis\":{\"type\":\"category\",\"data\":[\"搜索广告\",\"信息流\",\"短视频\",\"社交媒体\"]},\"yAxis\":{\"type\":\"value\",\"name\":\"ROI\"},\"series\":[{\"type\":\"bar\",\"data\":[3.51,2.60,2.06,1.56],\"itemStyle\":{\"color\":\"#818cf8\"}}]}\n-->\n\n**结论：** 搜索广告 ROI 最高（3.51），建议增加预算。社交媒体 ROI 偏低，需要优化素材或调整受众定向。";
  }
  if (input.includes("流失") || input.includes("原因")) {
    return "## 用户流失分析\n\n通过漏斗分析，主要流失节点：\n\n1. **注册 → 首次使用**：流失率 42%\n   - 原因：新手引导过长，用户耐心不足\n   - 建议：简化 onboarding，3 步内完成\n\n2. **首次使用 → 7 日留存**：流失率 65%\n   - 原因：核心功能发现率低\n   - 建议：增加功能引导气泡\n\n3. **活跃 → 付费**：流失率 88%\n   - 原因：付费墙出现时机不当\n   - 建议：先让用户体验到价值再引导付费\n\n<!--chart\n{\"title\":{\"text\":\"用户转化漏斗\"},\"xAxis\":{\"type\":\"value\"},\"yAxis\":{\"type\":\"category\",\"data\":[\"注册\",\"首次使用\",\"7日留存\",\"付费\"],\"inverse\":true},\"series\":[{\"type\":\"bar\",\"data\":[10000,5800,2030,244],\"itemStyle\":{\"color\":\"#818cf8\"}}]}\n-->\n\n> 以上数据为模拟分析结果，实际产品中会通过埋点数据 + LLM 自动生成。";
  }
  if (input.includes("投放") || input.includes("优化") || input.includes("建议")) {
    return "## 本周投放优化建议\n\n基于过去 7 天的数据分析，给出以下优化方案：\n\n### 🟢 立即执行\n\n1. **搜索广告加预算 30%** — ROI 3.51，是所有渠道最高的，有明显的扩量空间\n2. **信息流素材 A/B 测试** — 当前 CTR 2.1%，行业均值 2.8%，素材是瓶颈\n\n### 🟡 本周内完成\n\n3. **落地页加载优化** — 3/17 转化率骤降与页面加载 3.2s 强相关，目标压到 1.5s 以内\n4. **社交媒体暂停低效计划** — ROI < 1.6 的计划全部暂停，释放预算给搜索渠道\n\n### 📊 预期效果\n\n| 指标 | 当前 | 优化后预估 | 提升 |\n|------|------|-----------|------|\n| 整体 ROI | 2.8 | 3.2 | +14% |\n| 日均转化 | 724 | 890 | +23% |\n| 获客成本 | ¥2,340 | ¥1,980 | -15% |\n\n<!--chart\n{\"title\":{\"text\":\"优化前后对比\"},\"legend\":{\"top\":28},\"xAxis\":{\"type\":\"category\",\"data\":[\"整体 ROI\",\"日均转化(百)\",\"获客成本(千)\"]},\"yAxis\":{\"type\":\"value\"},\"series\":[{\"name\":\"当前\",\"type\":\"bar\",\"data\":[2.8,7.24,2.34]},{\"name\":\"优化后\",\"type\":\"bar\",\"data\":[3.2,8.90,1.98]}]}\n-->\n\n> 以上为基于历史数据的预测模型输出，实际效果需要 A/B 测试验证。";
  }
  if (input.includes("用户") || input.includes("画像") || input.includes("人群")) {
    return "## 核心用户画像分析\n\n```sql\nSELECT age_group, gender, city_tier,\n       COUNT(*) AS users,\n       AVG(order_amount) AS avg_spend\nFROM user_profiles\nJOIN orders USING(user_id)\nWHERE order_date >= '2026-03-01'\nGROUP BY age_group, gender, city_tier\nORDER BY users DESC LIMIT 10\n```\n\n### 用户分布\n\n| 人群 | 占比 | 客单价 | 复购率 |\n|------|------|--------|--------|\n| 25-34 女性·一线 | 28% | ¥218 | 34% |\n| 25-34 男性·一线 | 22% | ¥195 | 28% |\n| 18-24 女性·二线 | 18% | ¥142 | 21% |\n| 35-44 男性·一线 | 15% | ¥267 | 41% |\n| 其他 | 17% | ¥128 | 15% |\n\n<!--chart\n{\"title\":{\"text\":\"用户年龄分布\"},\"series\":[{\"type\":\"pie\",\"radius\":[\"40%\",\"70%\"],\"data\":[{\"name\":\"25-34 女\",\"value\":28},{\"name\":\"25-34 男\",\"value\":22},{\"name\":\"18-24 女\",\"value\":18},{\"name\":\"35-44 男\",\"value\":15},{\"name\":\"其他\",\"value\":17}]}]}\n-->\n\n**洞察：**\n- 核心用户是 **25-34 岁一线城市女性**，贡献了 28% 的用户量和最高的复购率\n- **35-44 岁男性**虽然占比不高，但客单价最高（¥267），是高价值人群\n- 18-24 岁用户增长快但复购低，需要设计新客留存策略";
  }
  if (input.includes("日活") || input.includes("DAU")) {
    return "## 日活用户趋势分析\n\n<!--chart\n{\"title\":{\"text\":\"7 日 DAU 趋势\"},\"xAxis\":{\"type\":\"category\",\"data\":[\"3/12\",\"3/13\",\"3/14\",\"3/15\",\"3/16\",\"3/17\",\"3/18\"]},\"yAxis\":{\"type\":\"value\",\"name\":\"万\"},\"series\":[{\"name\":\"DAU\",\"type\":\"line\",\"data\":[11.2,11.8,12.1,12.5,12.3,12.6,12.8],\"smooth\":true,\"areaStyle\":{\"opacity\":0.15}}]}\n-->\n\n| 日期 | DAU | 环比 | 新增用户 | 回流用户 |\n|------|-----|------|----------|----------|\n| 3/18 | 12.8 万 | +1.6% | 3,200 | 1,850 |\n| 3/17 | 12.6 万 | +2.4% | 2,980 | 1,720 |\n| 3/16 | 12.3 万 | -1.6% | 2,650 | 1,580 |\n| 3/15 | 12.5 万 | +3.3% | 3,100 | 1,900 |\n\n**分析：** DAU 整体呈上升趋势（+5.2% 周环比），3/16 小幅回落可能与周末效应有关。新增用户稳定在 2,600-3,200/天，回流用户占比约 15%。";
  }
  if (input.includes("客单价") || input.includes("ARPU")) {
    return "## 客单价分析\n\n<!--chart\n{\"title\":{\"text\":\"客单价趋势 & 分布\"},\"legend\":{\"top\":28},\"xAxis\":{\"type\":\"category\",\"data\":[\"3/12\",\"3/13\",\"3/14\",\"3/15\",\"3/16\",\"3/17\",\"3/18\"]},\"yAxis\":{\"type\":\"value\",\"name\":\"¥\"},\"series\":[{\"name\":\"客单价\",\"type\":\"bar\",\"data\":[168,172,175,180,178,183,186],\"itemStyle\":{\"color\":\"#818cf8\"}},{\"name\":\"行业均值\",\"type\":\"line\",\"data\":[165,165,165,165,165,165,165],\"lineStyle\":{\"type\":\"dashed\"},\"itemStyle\":{\"color\":\"#94a3b8\"}}]}\n-->\n\n客单价连续 7 天上升（¥168 → ¥186，+10.7%），主要驱动因素：\n- **高价值 SKU 占比提升** — 35-44 岁男性用户增长带动\n- **满减活动效果** — 满 200 减 30 活动提升了凑单率\n- **推荐算法优化** — 关联推荐点击率提升 18%";
  }
  const fallbacks = [
    `## 分析：${input}\n\n收到你的问题。作为数据分析专家 Agent，我的工作流程是：\n\n1. **理解意图** — 解析你的自然语言查询\n2. **生成 SQL** — 自动构建数据库查询语句\n3. **执行分析** — 运行统计分析和趋势识别\n4. **可视化** — 生成图表和数据表格\n5. **给出建议** — 基于数据给出可执行的业务建议\n\n> 💡 试试问我：「分析转化率趋势」「哪个渠道 ROI 最高」「用户流失原因」「投放优化建议」「用户画像分析」`,
    `## 关于「${input}」\n\n这是一个很好的分析方向。在实际产品中，我会：\n\n- 从数据仓库中提取相关指标\n- 进行同比/环比对比分析\n- 识别异常波动和归因\n- 生成可视化报告\n\n目前支持的分析主题：**转化率趋势、渠道 ROI、用户流失、投放优化、用户画像、DAU 趋势、客单价分析**\n\n> 这是演示模式，数据为模拟生成。`,
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}


export default function ExpertAgentPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

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

  // 智能自动滚动：只在用户处于底部附近时才跟随
  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: streaming ? "instant" : "smooth" } as ScrollIntoViewOptions);
    }
  }, [messages, streaming]);

  const scrollToBottom = useCallback(() => {
    isNearBottomRef.current = true;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // 组件卸载清理
  useEffect(() => { return () => { cancelRef.current?.(); }; }, []);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || streaming) return;
    isNearBottomRef.current = true; // 发送新消息时恢复自动滚动
    const userMsg: Message = { role: "user", content: text.trim(), timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "", timestamp: Date.now(), streaming: true }]);
    setInput("");
    setStreaming(true);
    const fullReply = getMockReply(text);
    cancelRef.current = mockSSEStream(fullReply, (chunk) => {
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        copy[copy.length - 1] = { ...last, content: last.content + chunk };
        return copy;
      });
    }, () => {
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        copy[copy.length - 1] = { ...last, streaming: false };
        return copy;
      });
      setStreaming(false);
      cancelRef.current = null;
    });
  }, [streaming]);

  const handleStop = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last?.role === "assistant" && last.streaming) {
        copy[copy.length - 1] = { ...last, streaming: false };
      }
      return copy;
    });
    setStreaming(false);
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/20">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">数据分析专家 Agent</h1>
            <p className="text-sm text-muted-foreground">SQL 查询 + 数据分析 + ECharts 可视化 + 优化建议</p>
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        {/* 左侧：指标卡片 */}
        <div className="w-[260px] shrink-0 border-r border-border p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            实时指标概览
            <MousePointerClick className="h-3 w-3 text-muted-foreground/40" />
          </p>
          <div className="flex flex-col gap-2.5">
            {METRICS.map((m) => (
              <button key={m.label} onClick={() => sendMessage(m.query)} disabled={streaming}
                className="rounded-xl border border-border bg-card p-3.5 text-left transition-all hover:border-emerald-500/20 hover:bg-emerald-500/[0.03] disabled:opacity-50">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                  <span className="text-[10px] text-muted-foreground/60">{m.unit}</span>
                </div>
                <div className="mt-1 flex items-end justify-between">
                  <span className="text-lg font-semibold text-foreground">{m.value}</span>
                  <span className={cn("flex items-center gap-0.5 text-xs font-medium",
                    m.change > 0 ? "text-emerald-400" : m.change < 0 ? "text-rose-400" : "text-muted-foreground")}>
                    {m.change > 0 ? <TrendingUp className="h-3 w-3" /> : m.change < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    {m.change > 0 ? "+" : ""}{m.change}%
                  </span>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">快捷提问</p>
            <div className="flex flex-col gap-1.5">
              {PRESET_QUESTIONS.map((q) => (
                <button key={q} onClick={() => sendMessage(q)} disabled={streaming}
                  className="rounded-lg bg-secondary/50 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50">
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧：对话区 */}
        <div className="flex flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <ScrollArea ref={scrollAreaRef} className="h-full">
              <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Sparkles className="mb-3 h-8 w-8 text-emerald-400/40" />
                    <p className="text-sm text-muted-foreground">向数据分析专家提问，获取数据洞察和可视化报告</p>
                    <p className="mt-1 text-xs text-muted-foreground/50">点击左侧指标卡片可快速触发分析</p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      msg.role === "user" ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
                        : "bg-card text-foreground ring-1 ring-border")}>
                      {msg.role === "assistant" ? (
                        (() => {
                          const isLast = i === messages.length - 1;
                          const isCurrentStreaming = !!(msg.streaming && isLast);
                          // 流式期间用 parseStreamingSegments（支持 skeleton），完成后用 parseChartBlocks
                          if (isCurrentStreaming) {
                            const segs = parseStreamingSegments(msg.content);
                            const hasChartOrSkeleton = segs.some((s) => s.type === "chart" || s.type === "skeleton");
                            if (!hasChartOrSkeleton) return <MarkdownContent content={msg.content} streaming />;
                            return segs.map((seg, si) =>
                              seg.type === "text" ? <MarkdownContent key={si} content={seg.value} streaming />
                                : seg.type === "skeleton" ? <ChartSkeleton key={si} />
                                  : <EChartBubble key={si} option={seg.option} height={seg.height} />
                            );
                          }
                          const { segments } = parseChartBlocks(msg.content);
                          const hasCharts = segments.some((s) => s.type === "chart");
                          if (!hasCharts) return <MarkdownContent content={msg.content} />;
                          return segments.map((seg, si) =>
                            seg.type === "text" ? <MarkdownContent key={si} content={seg.value} />
                              : <EChartBubble key={si} option={seg.option} height={seg.height} />
                          );
                        })()
                      ) : msg.content}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>
            {/* 回到底部按钮 */}
            {showScrollBtn && (
              <button onClick={scrollToBottom}
                className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs text-muted-foreground shadow-lg backdrop-blur transition-colors hover:text-foreground">
                <ArrowDown className="h-3 w-3" /> 回到底部
              </button>
            )}
          </div>
          <div className="shrink-0 border-t border-border p-4">
            <div className="mx-auto flex max-w-3xl items-end gap-3">
              <textarea value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                rows={1} placeholder="输入数据分析问题…"
                className="min-h-[48px] flex-1 resize-none rounded-xl border border-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/30" />
              {streaming ? (
                <Button onClick={handleStop} size="icon" variant="outline"
                  className="h-[48px] w-[48px] shrink-0 rounded-xl border-destructive/50 text-destructive hover:bg-destructive/10">
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={() => sendMessage(input)} disabled={!input.trim()} size="icon"
                  className="h-[48px] w-[48px] shrink-0 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/20 disabled:opacity-40 disabled:shadow-none">
                  <Send className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
