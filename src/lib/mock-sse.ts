/**
 * 模拟 SSE 流式输出
 */
export function mockSSEStream(
  text: string,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  speed = 30,
): () => void {
  let index = 0;
  let cancelled = false;
  const tick = () => {
    if (cancelled || index >= text.length) {
      if (!cancelled) onDone();
      return;
    }
    // 模拟真实 LLM token 速度波动：标点/换行后稍慢，正文快
    const char = text[index];
    const isPause = /[。！？\n\r.!?]/.test(char);
    const isHeading = text.slice(index, index + 2) === "##";
    const chunkSize = Math.min(Math.floor(Math.random() * 3) + 1, text.length - index);
    onChunk(text.slice(index, index + chunkSize));
    index += chunkSize;
    const delay = isPause ? speed * 3 + Math.random() * 40
      : isHeading ? speed * 2
        : speed + Math.random() * 20 - 10;
    setTimeout(tick, Math.max(10, delay));
  };
  tick();
  return () => { cancelled = true; };
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/* ── 预设回复 ── */

const R_GREETING = `你好！我是 AI 助手，很高兴为你服务。

我可以帮你完成以下任务：

- **代码生成**：根据需求生成代码片段
- **问题解答**：回答技术相关问题
- **文档撰写**：帮助编写技术文档

请问有什么可以帮你的？`;

const R_CODE = `好的，这是一个 React Hook 的示例：

\`\`\`typescript
import { useState, useCallback, useEffect } from 'react';

export function useCounter(initial = 0) {
  const [count, setCount] = useState(initial);
  const doubled = count * 2;

  const increment = useCallback(() => setCount(c => c + 1), []);
  const decrement = useCallback(() => setCount(c => c - 1), []);

  useEffect(() => {
    console.log('Counter mounted with value:', count);
  }, []);

  return { count, doubled, increment, decrement };
}
\`\`\`

这个 Hook 封装了一个计数器逻辑，支持递增、递减，并提供了一个派生值 \`doubled\`。你可以继续问我关于这段代码的问题。`;

const R_MARKDOWN = `# Markdown 渲染演示

## 支持的格式

### 1. 列表
- 无序列表项 1
- 无序列表项 2
  - 嵌套列表

### 2. 代码块
\`\`\`javascript
const greeting = "Hello, World!";
console.log(greeting);
\`\`\`

### 3. 表格

| 功能 | 状态 | 说明 |
|------|------|------|
| 流式输出 | ✅ | SSE 模拟 |
| Markdown | ✅ | marked 渲染 |
| 代码高亮 | ✅ | 内联样式 |

### 4. 引用

> 这是一段引用文本，用于展示 blockquote 的渲染效果。

**加粗**、*斜体*、\`行内代码\` 都支持。`;

const R_PERFORMANCE = `React 项目常见的性能优化手段：

## 1. 渲染优化

- **React.memo** — 避免不必要的子组件重渲染
- **useMemo / useCallback** — 缓存计算结果和回调引用
- **虚拟列表** — 大数据量用 \`react-window\` 或 \`@tanstack/virtual\`

\`\`\`typescript
const UserCard = React.memo(({ name, avatar }: Props) => {
  return (
    <div className="card">
      <img src={avatar} alt={name} />
      <span>{name}</span>
    </div>
  );
});
\`\`\`

## 2. 代码分割

- **动态 import** + \`React.lazy\` + \`Suspense\`
- **路由级分割** — Next.js App Router 自动支持

## 3. 状态管理

| 方案 | 适用场景 | 重渲染范围 |
|------|----------|-----------|
| useState | 局部状态 | 当前组件 |
| useContext | 跨层级共享 | 所有消费者 |
| Zustand | 全局状态 | 精确订阅 |
| Jotai | 原子化状态 | 最小粒度 |

> 关键原则：**状态下沉**，让状态尽可能靠近使用它的组件，减少不必要的重渲染范围。

## 4. 网络优化

- 图片懒加载 + WebP/AVIF 格式
- API 请求去重 + SWR/React Query 缓存
- 预加载关键资源 \`<link rel="preload">\``;

/* ── 多轮追问回复 ── */

const R_EXPLAIN_CODE = `好的，我来逐行解释这段代码：

1. **\`useState(initial)\`** — 创建一个响应式状态 \`count\`，初始值由参数传入，默认为 0

2. **\`const doubled = count * 2\`** — 这是一个派生值，每次 \`count\` 变化时组件重渲染，\`doubled\` 会自动重新计算。注意这里没有用 \`useMemo\`，因为乘法运算开销极小，不需要缓存

3. **\`useCallback\`** — 包裹 \`increment\` 和 \`decrement\`，确保函数引用稳定。如果把这些函数传给子组件，配合 \`React.memo\` 可以避免不必要的重渲染

4. **\`useEffect(fn, [])\`** — 空依赖数组意味着只在挂载时执行一次，类似 class 组件的 \`componentDidMount\`

> 这种把状态逻辑抽成自定义 Hook 的模式叫 **逻辑复用**，是 React Hooks 最核心的设计理念。`;

const R_IMPROVE_CODE = `可以从几个方面改进：

\`\`\`typescript
import { useState, useCallback, useMemo } from 'react';

export function useCounter(initial = 0, { min, max }: { min?: number; max?: number } = {}) {
  const [count, setCount] = useState(initial);

  const increment = useCallback(() => {
    setCount(c => (max !== undefined ? Math.min(c + 1, max) : c + 1));
  }, [max]);

  const decrement = useCallback(() => {
    setCount(c => (min !== undefined ? Math.max(c - 1, min) : c - 1));
  }, [min]);

  const reset = useCallback(() => setCount(initial), [initial]);

  const derived = useMemo(() => ({
    doubled: count * 2,
    isZero: count === 0,
    isAtMax: max !== undefined && count >= max,
    isAtMin: min !== undefined && count <= min,
  }), [count, min, max]);

  return { count, ...derived, increment, decrement, reset };
}
\`\`\`

改进点：
- 支持 **min/max 边界**，防止越界
- 增加 **reset** 方法
- 用 \`useMemo\` 聚合派生值，语义更清晰
- \`useCallback\` 依赖数组正确声明`;

const R_FOLLOWUP_PERF = `补充几个进阶优化技巧：

### 5. React Compiler（React 19+）

React 19 引入了编译器，可以**自动**帮你做 memo 优化，不再需要手写 \`useMemo\` / \`useCallback\`：

\`\`\`typescript
// React Compiler 会自动分析依赖，生成优化代码
function TodoList({ todos, filter }) {
  const filtered = todos.filter(t => t.status === filter);
  return filtered.map(t => <TodoItem key={t.id} todo={t} />);
}
// 编译后等价于自动包了 useMemo + React.memo
\`\`\`

### 6. 并发特性

- **useTransition** — 标记低优先级更新，保持 UI 响应
- **useDeferredValue** — 延迟渲染非关键内容

### 7. 服务端组件（RSC）

Next.js App Router 默认使用 Server Components：
- 零客户端 JS 开销
- 直接访问数据库/文件系统
- 自动代码分割

> 2025 年的趋势是：**能在服务端做的就不要在客户端做**。`;

const R_GENERIC_FOLLOWUP = `基于我们之前的对话，我理解你想深入了解这个话题。

这里有几个相关的延伸方向：

1. **架构层面** — 如何在项目中系统性地应用这些技术
2. **实战案例** — 具体的业务场景和解决方案
3. **最佳实践** — 社区推荐的模式和反模式

你想往哪个方向继续聊？或者你可以直接问具体的问题。`;

/* ── AI / AIGC 相关话题 ── */

const R_AIGC = `## AIGC 技术全景

2026 年 AIGC 已经渗透到几乎所有内容生产环节：

### 文本生成
- **对话式 AI** — ChatGPT、Claude、Gemini，日均处理数十亿次对话
- **代码生成** — GitHub Copilot、Cursor，开发者生产力提升 30-50%
- **文档写作** — Notion AI、Jasper，从大纲到成稿一键生成

### 图像 / 视频
- **图片生成** — Midjourney v7、DALL·E 4、Stable Diffusion 3
- **视频生成** — Sora、Runway Gen-3、Pika，从文字到视频
- **数字人** — HeyGen、Synthesia，虚拟主播和数字分身

### 语音 / 音频
- **语音合成** — ElevenLabs、Azure TTS，接近真人的语音质量
- **语音对话** — ChatGPT Advanced Voice、Gemini Live
- **音乐生成** — Suno、Udio，文字描述生成完整歌曲

### 前端开发者的机会

作为前端开发者，AIGC 带来的不是替代，而是新的产品形态：
- 流式渲染、实时交互、多模态输入
- 这些都是**前端密集型**的工程挑战

> 💡 这个 Playground 展示的就是这些产品形态的前端交互层实现。`;

/* ── 设计模式话题 ── */

const R_DESIGN_PATTERN = `## 前端常用设计模式

### 1. 组合模式（Composition）

React 推崇组合优于继承：

\`\`\`typescript
// 通过 children 和 render props 实现灵活组合
function Card({ header, children, footer }: CardProps) {
  return (
    <div className="card">
      {header && <div className="card-header">{header}</div>}
      <div className="card-body">{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}
\`\`\`

### 2. 观察者模式（Observer）

状态管理的核心：

| 实现 | 原理 | 适用场景 |
|------|------|----------|
| useState | 组件内部状态 | 局部 UI 状态 |
| Zustand | 发布-订阅 | 跨组件共享 |
| RxJS | 响应式流 | 复杂异步流 |

### 3. 策略模式（Strategy）

\`\`\`typescript
const validators: Record<string, (v: string) => boolean> = {
  email: (v) => /^[^@]+@[^@]+$/.test(v),
  phone: (v) => /^1[3-9]\\d{9}$/.test(v),
  url: (v) => /^https?:\\/\\//.test(v),
};

function validate(type: string, value: string) {
  return validators[type]?.(value) ?? false;
}
\`\`\`

> 设计模式不是银弹，关键是在合适的场景选择合适的模式。`;

/* ── 数据分析报告（含多个 ECharts 图表） ── */

const R_CHART_REPORT = `## 📊 Q1 季度销售数据分析报告

基于你提供的数据，我从多个维度进行了分析，以下是完整报告：

### 一、月度营收趋势

1-3 月整体呈上升趋势，3 月环比增长 **23.5%**，主要受春季促销活动拉动。

<!--chart:260
{"title":{"text":"月度营收趋势（万元）","left":"center"},"tooltip":{"trigger":"axis"},"legend":{"top":28},"xAxis":{"type":"category","data":["1月","2月","3月","4月","5月","6月"]},"yAxis":{"type":"value","name":"万元"},"series":[{"name":"营收","type":"line","data":[186,205,253,241,278,312],"smooth":true,"areaStyle":{"opacity":0.15},"lineStyle":{"width":3},"itemStyle":{"color":"#818cf8"}},{"name":"利润","type":"line","data":[42,51,68,59,74,89],"smooth":true,"lineStyle":{"width":2,"type":"dashed"},"itemStyle":{"color":"#34d399"}}]}
-->

### 二、各品类销售占比

从品类结构看，**智能硬件**占比最高（35%），其次是**SaaS 订阅**（28%）。

<!--chart:260
{"title":{"text":"品类销售占比","left":"center"},"tooltip":{"trigger":"item","formatter":"{b}: {c}万 ({d}%)"},"legend":{"bottom":"0%"},"series":[{"type":"pie","radius":["35%","65%"],"center":["50%","45%"],"data":[{"value":312,"name":"智能硬件","itemStyle":{"color":"#818cf8"}},{"value":249,"name":"SaaS 订阅","itemStyle":{"color":"#a78bfa"}},{"value":178,"name":"数据服务","itemStyle":{"color":"#67e8f9"}},{"value":142,"name":"咨询培训","itemStyle":{"color":"#34d399"}},{"value":98,"name":"其他","itemStyle":{"color":"#fbbf24"}}],"emphasis":{"itemStyle":{"shadowBlur":10,"shadowColor":"rgba(0,0,0,0.3)"}}}]}
-->

### 三、各区域业绩对比

华东区以 **387 万**领跑，华南区增速最快（环比 +31%）。

<!--chart:280
{"title":{"text":"区域业绩对比","left":"center"},"tooltip":{"trigger":"axis"},"legend":{"bottom":"0%"},"xAxis":{"type":"category","data":["华东","华南","华北","西南","华中","西北"]},"yAxis":{"type":"value","name":"万元"},"series":[{"name":"Q1 实际","type":"bar","data":[387,298,265,189,156,112],"itemStyle":{"color":"#818cf8"}},{"name":"Q1 目标","type":"bar","data":[350,280,300,200,180,130],"itemStyle":{"color":"rgba(129,140,248,0.18)","borderColor":"#818cf8","borderWidth":1}}]}
-->

### 四、团队能力雷达图

综合评估各维度能力，**产品创新**和**客户满意度**表现突出，**交付效率**有提升空间。

<!--chart:300
{"title":{"text":"团队能力评估","left":"center"},"tooltip":{},"legend":{"bottom":"0%"},"radar":{"indicator":[{"name":"产品创新","max":100},{"name":"客户满意度","max":100},{"name":"市场拓展","max":100},{"name":"交付效率","max":100},{"name":"技术深度","max":100},{"name":"团队协作","max":100}],"shape":"circle","splitArea":{"areaStyle":{"color":["rgba(99,102,241,0.02)","rgba(99,102,241,0.05)","rgba(99,102,241,0.08)","rgba(99,102,241,0.11)"]}}},"series":[{"type":"radar","data":[{"value":[92,88,75,62,81,85],"name":"当前","areaStyle":{"opacity":0.2},"lineStyle":{"color":"#818cf8","width":2},"itemStyle":{"color":"#818cf8"}},{"value":[80,78,82,80,75,78],"name":"行业均值","lineStyle":{"color":"#94a3b8","type":"dashed","width":1},"itemStyle":{"color":"#94a3b8"}}]}]}
-->

### 五、关键结论

| 指标 | 数值 | 环比 | 评价 |
|------|------|------|------|
| 总营收 | 1,475 万 | +18.2% | 🟢 超预期 |
| 净利润率 | 21.3% | +2.1pp | 🟢 健康 |
| 客户留存率 | 94.7% | +1.3pp | 🟢 优秀 |
| 新客获取成本 | 2,340 元 | -8.5% | 🟡 待优化 |
| 交付周期 | 12.5 天 | +1.2 天 | 🔴 需关注 |

> 💡 **建议**：重点关注交付效率的提升，建议引入自动化流程减少人工环节。华南区增速亮眼，可考虑加大该区域资源投入。`;

/* ── 上下文感知的回复匹配 ── */

type Topic = "code" | "markdown" | "performance" | "greeting" | "chart" | "aigc" | "pattern" | null;

function detectTopic(text: string): Topic {
  const l = text.toLowerCase();
  if (l.includes("数据") || l.includes("分析") || l.includes("报告") || l.includes("图表") || l.includes("销售") || l.includes("chart") || l.includes("echart") || l.includes("可视化") || l.includes("统计")) return "chart";
  if (l.includes("代码") || l.includes("code") || l.includes("hook") || l.includes("示例") || l.includes("函数")) return "code";
  if (l.includes("markdown") || l.includes("格式") || l.includes("渲染")) return "markdown";
  if (l.includes("性能") || l.includes("performance") || l.includes("memo") || l.includes("虚拟列表")) return "performance";
  if (l.includes("aigc") || l.includes("ai") || l.includes("大模型") || l.includes("llm") || l.includes("生成式")) return "aigc";
  if (l.includes("设计模式") || l.includes("pattern") || l.includes("架构") || l.includes("组合") || l.includes("策略")) return "pattern";
  if (l.includes("你好") || l.includes("介绍") || l.includes("hello") || l.includes("hi")) return "greeting";
  return null;
}

function isFollowUp(text: string): boolean {
  const l = text.toLowerCase();
  return /解释|详细|为什么|怎么|如何|改进|优化|继续|更多|深入|补充|还有|接着/.test(l);
}

/**
 * 根据当前输入 + 历史对话生成回复
 * 支持多轮追问：如果用户说"解释一下"，会基于上一轮话题回复
 */
export function getReply(input: string, history: ChatMessage[] = []): string {
  const topic = detectTopic(input);
  const followUp = isFollowUp(input);

  // 有明确话题 → 直接匹配
  if (topic === "chart") return R_CHART_REPORT;
  if (topic === "code") return R_CODE;
  if (topic === "markdown") return R_MARKDOWN;
  if (topic === "performance") return R_PERFORMANCE;
  if (topic === "aigc") return R_AIGC;
  if (topic === "pattern") return R_DESIGN_PATTERN;
  if (topic === "greeting") return R_GREETING;

  // 追问 → 看上一轮话题
  if (followUp && history.length >= 2) {
    const lastAssistant = [...history].reverse().find(m => m.role === "assistant");
    if (lastAssistant) {
      const lastTopic = detectTopic(lastAssistant.content);
      if (lastTopic === "code") {
        if (/改进|优化|改善|更好/.test(input)) return R_IMPROVE_CODE;
        return R_EXPLAIN_CODE;
      }
      if (lastTopic === "performance") return R_FOLLOWUP_PERF;
    }
    return R_GENERIC_FOLLOWUP;
  }

  // 智能兜底：随机选择一个话题，避免每次都是 greeting
  const fallbackTopics = [R_GREETING, R_AIGC, R_DESIGN_PATTERN];
  return fallbackTopics[Math.floor(Math.random() * fallbackTopics.length)];
}
