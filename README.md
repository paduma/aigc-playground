# AIGC Playground 🎮

**English** | [中文](README.zh.md)

> 13 AI product interaction patterns, pure frontend, fork and run | [Live Demo](https://paduma.github.io/aigc-playground/)

Ever used ChatGPT, Midjourney, or a digital human livestream? How are the frontend interactions behind these AI products actually built?

This project breaks down mainstream AI product patterns into 13 standalone demos. Each one is interactive, explorable, and fully readable. All mock data, no API keys, no backend — just `npm install && npm run dev`.

## 🤖 Vibe Coded

This project is built through vibe coding — a human-AI collaborative development approach where the developer drives product decisions, architecture, and quality standards while AI assists with implementation.

What does that mean concretely?

- Every demo was designed, reviewed, and iterated by a human developer
- AI (Kiro) assisted with code generation, bug fixing, and feature implementation
- The developer maintained full control over product direction and code quality

This is NOT spec coding (where AI autonomously generates code from specifications with minimal human involvement). Vibe coding is hands-on collaboration — the human stays in the loop at every step, making judgment calls on UX, architecture, and edge cases that AI alone would miss.

## Quick Start

**Fork this repo** to experiment in your own space:

1. Click the **Fork** button in the top right
2. Clone your forked repo

```bash
git clone https://github.com/<your-username>/aigc-playground.git
cd aigc-playground
npm install
npm run dev
```

Open http://localhost:3000

## What's Inside

Four categories, 13 demos:

### 💬 Understanding & Conversation

| Demo                | Route               | Highlights                                                                   |
| ------------------- | ------------------- | ---------------------------------------------------------------------------- |
| Multimodal Chat     | `/chat`             | SSE streaming typewriter, inline ECharts rendering, multi-session, file drag |
| Voice Chat          | `/voice`            | Web Speech API, real-time waveform + spectrum animation                      |
| RAG Knowledge Base  | `/rag`              | Document chunking, similarity matching, citation tracing                     |
| Video Understanding | `/video-understand` | Timeline annotation, keyframe extraction, content summary                    |

### 🤖 Agents

| Demo                | Route           | Highlights                                                |
| ------------------- | --------------- | --------------------------------------------------------- |
| Data Analysis Agent | `/expert-agent` | Natural language → ECharts charts, SQL generation         |
| Conversational Form | `/diagnose`     | Multi-turn guided info collection, conditional branching  |
| Agent Orchestration | `/agent-flow`   | Visual canvas, drag-drop nodes, simple/workflow dual mode |

### ✨ Content Creation

| Demo                | Route         | Highlights                                                                      |
| ------------------- | ------------- | ------------------------------------------------------------------------------- |
| AI Writing          | `/ai-writing` | Floating toolbar on selection, polish/translate/expand, typewriter continuation |
| Image Generation    | `/image-gen`  | Masonry gallery, 4-grid generation, variant creation                            |
| AI Video Generation | `/video-gen`  | Keyframe timeline, parameter panel, generation history                          |

### 🌐 Real-time & Embodied

| Demo               | Route             | Highlights                                                      |
| ------------------ | ----------------- | --------------------------------------------------------------- |
| Digital Human      | `/digital-human`  | Blendshape facial drive, TTS script broadcast, Canvas rendering |
| Real-time Video    | `/realtime-video` | WebRTC P2P, SDP signaling, live bitrate/FPS/RTT                 |
| Skeleton Animation | `/pose-skeleton`  | COCO-17 keypoints, Tai Chi sequence, frame interpolation        |

## Tech Stack

| Category   | Choice                                 |
| ---------- | -------------------------------------- |
| Framework  | Next.js 16 + React 19 (React Compiler) |
| Styling    | Tailwind CSS v4 + oklch color system   |
| Components | shadcn/ui + Base UI + Lucide Icons     |
| Charts     | ECharts 6                              |
| Voice      | Web Speech API                         |
| Real-time  | WebRTC                                 |
| Markdown   | marked                                 |

## Why All Mock?

This isn't another "ChatGPT API wrapper with a chat box".

The focus is on the interaction layer itself — how streaming rendering works, how voice chat state machines are designed, how Agent canvases handle drag-and-drop wiring, how digital human faces are driven, how WebRTC signaling flows. None of this depends on which LLM the backend uses.

Benefits of all-mock:

- Zero cost, no external services needed
- Works offline, no network dependency
- Focus on interactions, not API plumbing

## Project Structure

```
src/
├── app/                    # Pages (App Router)
│   ├── chat/               # Multimodal chat
│   ├── voice/              # Voice chat
│   ├── rag/                # RAG knowledge base
│   ├── video-understand/   # Video understanding
│   ├── expert-agent/       # Data analysis agent
│   ├── diagnose/           # Conversational form
│   ├── agent-flow/[id]/    # Agent orchestration
│   ├── ai-writing/         # AI writing
│   ├── image-gen/          # Image generation
│   ├── video-gen/          # AI video generation
│   ├── digital-human/      # Digital human
│   ├── realtime-video/     # WebRTC real-time
│   └── pose-skeleton/      # Skeleton animation
├── components/
│   ├── ui/                 # Base UI (shadcn/ui)
│   ├── chat/               # Chat components
│   └── sidebar.tsx         # Sidebar navigation
└── lib/
    ├── mock-sse.ts         # SSE streaming mock
    ├── chat-store.ts       # Chat state
    └── agent-store.ts      # Agent orchestration state
```

## Deployment

Push to main branch and GitHub Actions will auto-build and deploy to GitHub Pages.

## Contributing

Fork and PR welcome. If you find this helpful, a ⭐ Star is the best support.

## Author

Brook ([@paduma](https://github.com/paduma))

## License

MIT
