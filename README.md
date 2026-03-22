# AIGC Playground 🎮

> 13 个 AI 产品交互模式，纯前端实现，clone 下来就能跑

用过 ChatGPT、Midjourney、数字人直播吗？这些 AI 产品背后的前端交互到底怎么做的？

这个项目把主流 AI 产品形态拆成 13 个独立 demo，每个都能点、能玩、能看代码。全 Mock 数据，不需要 API Key，不需要后端，`npm install && npm run dev` 搞定。

<!-- ![AIGC Playground Overview](./docs/screenshots/overview.png) -->

## 快速开始

```bash
git clone https://github.com/padum/aigc-playground.git
cd aigc-playground
npm install
npm run dev
```

打开 http://localhost:3000 就能玩了。

## 有什么

四大类，13 个 demo：

### 💬 理解与对话

| Demo       | 路由                | 看点                                                   |
| ---------- | ------------------- | ------------------------------------------------------ |
| 多模态对话 | `/chat`             | SSE 流式打字机、ECharts 图表内联渲染、多会话、文件拖拽 |
| 语音对话   | `/voice`            | Web Speech API、实时波形 + 频谱动画                    |
| RAG 知识库 | `/rag`              | 文档分块、相似度匹配、引用溯源                         |
| 视频理解   | `/video-understand` | 时间轴标注、关键帧提取、内容摘要                       |

### � 智能体

| Demo           | 路由            | 看点                                      |
| -------------- | --------------- | ----------------------------------------- |
| 数据分析 Agent | `/expert-agent` | 自然语言→ECharts 图表、SQL 生成           |
| 对话式表单     | `/diagnose`     | 多轮引导收集信息、条件分支、结构化输出    |
| Agent 编排     | `/agent-flow`   | 可视化画布、拖拽节点连线、简单/编排双模式 |

### ✨ 内容创作

| Demo        | 路由          | 看点                                     |
| ----------- | ------------- | ---------------------------------------- |
| AI 写作     | `/ai-writing` | 选中文字弹浮窗、润色/翻译/扩写、流式续写 |
| 图片生成    | `/image-gen`  | 瀑布流画廊、4 宫格生成、变体创作         |
| AI 视频生成 | `/video-gen`  | 关键帧时间线、参数面板、生成历史         |

### 🌐 实时与具身

| Demo       | 路由              | 看点                                           |
| ---------- | ----------------- | ---------------------------------------------- |
| 数字人直播 | `/digital-human`  | Blendshape 面部驱动、TTS 脚本播报、Canvas 渲染 |
| 实时通信   | `/realtime-video` | WebRTC P2P、SDP 信令、实时码率/帧率/RTT        |
| 骨骼动画   | `/pose-skeleton`  | COCO-17 关键点、太极拳序列、帧间插值、运动轨迹 |

## 技术栈

| 类别     | 选型                                   |
| -------- | -------------------------------------- |
| 框架     | Next.js 16 + React 19 (React Compiler) |
| 样式     | Tailwind CSS v4 + oklch 色彩系统       |
| 组件     | shadcn/ui + Base UI + Lucide Icons     |
| 图表     | ECharts 6                              |
| 语音     | Web Speech API                         |
| 实时通信 | WebRTC                                 |
| Markdown | marked                                 |

## 为什么全是 Mock？

这不是又一个"套了 OpenAI API 的聊天框"。

项目关注的是交互层本身——流式渲染怎么做、语音对话的状态机怎么设计、Agent 画布怎么拖拽连线、数字人面部怎么驱动、WebRTC 信令怎么跑通。这些跟后端用哪个大模型没关系。

全 Mock 的好处：

- 零成本，不需要任何外部服务
- 离线可用，不受网络限制
- 聚焦交互，不纠结 API 调用

## 项目结构

```
src/
├── app/                    # 页面（App Router）
│   ├── chat/               # 多模态对话
│   ├── voice/              # 语音对话
│   ├── rag/                # RAG 知识库
│   ├── video-understand/   # 视频理解
│   ├── expert-agent/       # 数据分析 Agent
│   ├── diagnose/           # 对话式表单
│   ├── agent-flow/[id]/    # Agent 编排
│   ├── ai-writing/         # AI 写作
│   ├── image-gen/          # 图片生成
│   ├── video-gen/          # AI 视频生成
│   ├── digital-human/      # 数字人直播
│   ├── realtime-video/     # WebRTC 实时通信
│   └── pose-skeleton/      # 骨骼动画
├── components/             # 组件
│   ├── ui/                 # 基础 UI (shadcn/ui)
│   ├── chat/               # 对话组件
│   └── sidebar.tsx         # 侧边栏导航
└── lib/                    # 工具库
    ├── mock-sse.ts         # SSE 流式模拟
    ├── chat-store.ts       # 对话状态
    └── agent-store.ts      # Agent 编排状态
```

## 部署

```bash
npm run build
npm run start
```

或者一键部署到 Vercel：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/padum/aigc-playground)

## License

MIT
