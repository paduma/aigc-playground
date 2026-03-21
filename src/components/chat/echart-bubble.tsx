"use client";

import { useRef, useEffect, useMemo, memo } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart, RadarChart } from "echarts/charts";
import {
  TitleComponent, TooltipComponent, LegendComponent,
  GridComponent, RadarComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  BarChart, LineChart, PieChart, RadarChart,
  TitleComponent, TooltipComponent, LegendComponent,
  GridComponent, RadarComponent, CanvasRenderer,
]);

/* ── 统一暗色主题 & 设计规范 ── */
const PALETTE = [
  "#818cf8", "#a78bfa", "#67e8f9", "#34d399", "#fbbf24",
  "#f472b6", "#fb923c", "#38bdf8", "#c084fc", "#4ade80",
];

const DARK_THEME = {
  backgroundColor: "transparent",
  textStyle: { color: "rgba(255,255,255,0.85)", fontFamily: "inherit", fontSize: 12 },
  title: { textStyle: { color: "rgba(255,255,255,0.92)", fontSize: 13, fontWeight: 600 }, top: 4 },
  legend: { textStyle: { color: "rgba(255,255,255,0.72)", fontSize: 11 }, itemWidth: 12, itemHeight: 8, itemGap: 14 },
  tooltip: {
    backgroundColor: "rgba(12,12,24,0.96)",
    borderColor: "rgba(129,140,248,0.3)",
    borderWidth: 1,
    textStyle: { color: "#e2e8f0", fontSize: 12 },
    padding: [8, 12],
  },
  grid: { left: 48, right: 24, top: 48, bottom: 36, containLabel: false },
  categoryAxis: {
    axisLine: { lineStyle: { color: "rgba(255,255,255,0.12)" } },
    axisTick: { show: false },
    axisLabel: { color: "rgba(255,255,255,0.68)", fontSize: 11, margin: 10 },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: "rgba(255,255,255,0.58)", fontSize: 11, margin: 10 },
    splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)", type: "dashed" as const } },
  },
};

/** 自动为 bar 系列添加设计规范 */
function polishBarSeries(series: Record<string, unknown>[], totalBars: number, isHorizontal: boolean): Record<string, unknown>[] {
  const barWidth = totalBars <= 1 ? "32%" : totalBars <= 2 ? "24%" : "18%";
  const radius: [number, number, number, number] = isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0];
  return series.map((s, i) => {
    if (s.type !== "bar") return { ...s, itemStyle: { color: PALETTE[i % PALETTE.length], ...(s.itemStyle as object || {}) } };
    const existing = (s.itemStyle as Record<string, unknown>) || {};
    return {
      ...s,
      barWidth: s.barWidth ?? barWidth,
      barGap: "20%",
      itemStyle: {
        borderRadius: radius,
        color: PALETTE[i % PALETTE.length],
        ...existing,
      },
    };
  });
}

/** 自动为 line 系列添加设计规范 */
function polishLineSeries(series: Record<string, unknown>[]): Record<string, unknown>[] {
  return series.map((s, i) => {
    if (s.type !== "line") return s;
    const existing = (s.itemStyle as Record<string, unknown>) || {};
    const existingLine = (s.lineStyle as Record<string, unknown>) || {};
    return {
      ...s,
      symbolSize: s.symbolSize ?? 6,
      lineStyle: { width: 2.5, ...existingLine },
      itemStyle: { color: PALETTE[i % PALETTE.length], ...existing },
    };
  });
}

/** 自动为 pie 系列添加设计规范 */
function polishPieSeries(series: Record<string, unknown>[]): Record<string, unknown>[] {
  return series.map((s) => {
    if (s.type !== "pie") return s;
    const data = s.data as Array<Record<string, unknown>> | undefined;
    if (data) {
      const colored = data.map((d, i) => ({
        ...d,
        itemStyle: { color: PALETTE[i % PALETTE.length], ...(d.itemStyle as object || {}) },
      }));
      return {
        ...s,
        data: colored,
        label: { color: "rgba(255,255,255,0.78)", fontSize: 11, ...(s.label as object || {}) },
        emphasis: {
          itemStyle: { shadowBlur: 12, shadowColor: "rgba(0,0,0,0.4)" },
          ...(s.emphasis as object || {}),
        },
      };
    }
    return s;
  });
}

function applyDarkTheme(opt: Record<string, unknown>): Record<string, unknown> {
  const hasAxis = !!(opt.xAxis || opt.yAxis);
  const legend = opt.legend as Record<string, unknown> | undefined;
  const hasTitle = !!(opt.title && (opt.title as Record<string, unknown>).text);
  // legend 在底部且有坐标轴时，grid.bottom 需要额外留空间给 legend
  const legendAtBottom = legend && (legend.bottom !== undefined);
  const gridBottom = hasAxis && legendAtBottom ? 52 : 36;
  // 有 title + 顶部 legend 时，grid.top 需要更大
  const hasTopLegend = legend && !legendAtBottom;
  const gridTop = hasTitle && hasTopLegend ? 58 : hasTitle ? 40 : 48;
  // 有 title 时，没有显式位置的 legend 自动下移到 title 下方，避免压盖
  const legendDefaults: Record<string, unknown> = hasTitle && legend && legend.bottom === undefined && legend.top === undefined
    ? { top: 28 } : {};

  const themed: Record<string, unknown> = {
    ...opt,
    backgroundColor: "transparent",
    textStyle: DARK_THEME.textStyle,
    title: { ...(opt.title as object || {}), ...DARK_THEME.title },
    legend: { ...legendDefaults, ...(legend || {}), ...DARK_THEME.legend },
    tooltip: { ...(opt.tooltip as object || {}), ...DARK_THEME.tooltip },
    grid: hasAxis ? { ...DARK_THEME.grid, top: gridTop, bottom: gridBottom, ...(opt.grid as object || {}) } : opt.grid,
    xAxis: opt.xAxis ? (() => {
      const x = opt.xAxis as Record<string, unknown>;
      const theme = x.type === "value" ? DARK_THEME.valueAxis : DARK_THEME.categoryAxis;
      return { ...x, ...theme };
    })() : undefined,
    yAxis: opt.yAxis ? (() => {
      const y = opt.yAxis as Record<string, unknown>;
      const theme = y.type === "category" ? DARK_THEME.categoryAxis : DARK_THEME.valueAxis;
      return { ...y, ...theme };
    })() : undefined,
  };

  // 自动美化 series
  if (Array.isArray(opt.series)) {
    const series = opt.series as Record<string, unknown>[];
    const barCount = series.filter(s => s.type === "bar").length;
    // 检测是否为水平柱状图（xAxis 为 value 或 yAxis 为 category）
    const xAxis = opt.xAxis as Record<string, unknown> | undefined;
    const yAxis = opt.yAxis as Record<string, unknown> | undefined;
    const isHorizontal = xAxis?.type === "value" || yAxis?.type === "category";
    let polished = polishBarSeries(series, barCount, isHorizontal);
    polished = polishLineSeries(polished);
    polished = polishPieSeries(polished);
    themed.series = polished;
  }

  // 雷达图
  if (opt.radar) {
    const radar = opt.radar as Record<string, unknown>;
    themed.radar = {
      ...radar,
      axisName: { color: "rgba(255,255,255,0.72)", fontSize: 11 },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
      splitArea: radar.splitArea ?? {
        areaStyle: { color: ["rgba(99,102,241,0.02)", "rgba(99,102,241,0.05)", "rgba(99,102,241,0.08)", "rgba(99,102,241,0.11)"] },
      },
    };
  }

  return themed;
}

export const EChartBubble = memo(function EChartBubble({ option, height = 280 }: { option: Record<string, unknown>; height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  // 用 JSON 字符串做深比较，避免流式期间相同 option 反复触发 setOption 导致抖动
  const optionJson = JSON.stringify(option);
  const stableOption = useMemo(() => applyDarkTheme(JSON.parse(optionJson)), [optionJson]);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    if (chartRef.current) {
      chartRef.current.setOption(stableOption, true);
      return;
    }
    const chart = echarts.init(containerRef.current, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    chart.setOption(stableOption);

    const ro = new ResizeObserver(() => { if (!disposed) chart.resize(); });
    ro.observe(containerRef.current);

    return () => {
      disposed = true;
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [stableOption]);

  return (
    <div
      ref={containerRef}
      className="my-2 w-full rounded-lg animate-[fadeInUp_0.5s_ease-out]"
      style={{ height, minWidth: 300 }}
    />
  );
});

/** 流式输出期间的图表骨架占位 */
export function ChartSkeleton() {
  return (
    <div className="my-2 flex h-[200px] w-full items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02]">
      <div className="flex flex-col items-center gap-3 text-muted-foreground/40">
        <svg className="h-8 w-8 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="12" width="4" height="9" rx="1" />
          <rect x="10" y="7" width="4" height="14" rx="1" />
          <rect x="17" y="3" width="4" height="18" rx="1" />
        </svg>
        <span className="text-xs animate-pulse">图表生成中…</span>
      </div>
    </div>
  );
}

/** 统计内容中有多少个 chart 标记（含不完整的） */
export function countChartMarkers(content: string): number {
  return (content.match(/<!--chart/g) || []).length;
}

type StreamSegment =
  | { type: "text"; value: string }
  | { type: "chart"; option: Record<string, unknown>; height?: number }
  | { type: "skeleton" };

/**
 * 流式期间的渐进式分段解析：
 * - 已闭合的 <!--chart...--> 且 JSON 合法 → 立即渲染为真实图表
 * - 已闭合但 JSON 解析失败 → 当文本处理
 * - 未闭合的 <!--chart...（数据还在流入） → skeleton 占位
 * - 其余文本 → text
 */
export function parseStreamingSegments(content: string): StreamSegment[] {
  const segments: StreamSegment[] = [];
  // 匹配所有 <!--chart 开头的块（闭合或未闭合）
  const regex = /<!--chart(?::(\d+))?\n([\s\S]*?)\n-->|<!--chart[\s\S]*$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    // 前面的文本
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }

    const isClosed = match[0].endsWith("-->");
    if (isClosed && match[2] !== undefined) {
      // 已闭合，尝试解析 JSON → 渲染真实图表
      try {
        const option = JSON.parse(match[2]);
        const height = match[1] ? parseInt(match[1]) : undefined;
        segments.push({ type: "chart", option, height });
      } catch {
        // JSON 坏了，当文本
        segments.push({ type: "text", value: match[0] });
      }
    } else {
      // 未闭合 → skeleton
      segments.push({ type: "skeleton" });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }

  return segments;
}

/** 从消息内容中提取 chart JSON 块，返回 { text 部分, charts 数组 } */
export function parseChartBlocks(content: string): {
  segments: Array<{ type: "text"; value: string } | { type: "chart"; option: Record<string, unknown>; height?: number }>;
} {
  const segments: Array<{ type: "text"; value: string } | { type: "chart"; option: Record<string, unknown>; height?: number }> = [];
  const regex = /<!--chart((?::(\d+))?)\n([\s\S]*?)\n-->/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    try {
      const option = JSON.parse(match[3]);
      const height = match[2] ? parseInt(match[2]) : undefined;
      segments.push({ type: "chart", option, height });
    } catch {
      segments.push({ type: "text", value: match[0] });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }

  return { segments };
}
