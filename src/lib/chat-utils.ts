/* ── Chat 页面工具函数和类型 ── */

export interface Attachment {
  name: string;
  type: "image" | "file";
  size: number;
  preview: string;
  mimeType: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  timestamp: number;
  attachments?: Attachment[];
}

let _msgId = 0;
export function genMsgId(): string {
  return `msg-${Date.now()}-${++_msgId}`;
}

export const quickPrompts = [
  { label: "写一段代码", value: "请写一段 React Hook 的代码示例", icon: "Code2" as const },
  { label: "Markdown 演示", value: "展示一下 Markdown 渲染效果", icon: "FileText" as const },
  { label: "介绍一下你", value: "你好，介绍一下你自己", icon: "MessageCircle" as const },
  { label: "性能优化建议", value: "React 项目有哪些常见的性能优化手段？", icon: "Zap" as const },
];

export const MODELS = [
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI" },
  { id: "claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic" },
  { id: "deepseek-v3", name: "DeepSeek V3", provider: "DeepSeek" },
  { id: "qwen-max", name: "通义千问 Max", provider: "阿里云" },
  { id: "glm-4", name: "GLM-4", provider: "智谱" },
];

export function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 172800000) return "昨天";
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

export function estimateTokens(text: string): number {
  const cjk = text.match(/[\u4e00-\u9fff\u3000-\u303f]/g)?.length || 0;
  const rest = text.length - cjk;
  return Math.round(cjk * 1.5 + rest * 0.4);
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function getFileIconName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "ImageIcon";
  if (["json", "csv", "xlsx", "xls"].includes(ext)) return "FileSpreadsheet";
  if (["js", "ts", "tsx", "jsx", "py", "java", "go", "rs"].includes(ext)) return "FileCode";
  return "FileText";
}

export async function processFile(file: File): Promise<Attachment> {
  const isImage = file.type.startsWith("image/");
  return {
    name: file.name,
    type: isImage ? "image" : "file",
    size: file.size,
    preview: isImage ? URL.createObjectURL(file) : "",
    mimeType: file.type,
  };
}

export function getMultimodalReply(text: string, attachments: Attachment[]): string {
  const hasImage = attachments.some((a) => a.type === "image");
  const hasFile = attachments.some((a) => a.type === "file");
  if (hasImage && hasFile) {
    return `收到 ${attachments.length} 个文件，包含图片和文档。${text ? `关于「${text}」，` : ""}在实际产品中，这里会调用多模态模型（如 GPT-4o）进行联合理解。\n\n**技术要点：**\n- 图片通过 Vision API 编码为 base64 传入\n- 文档先经过解析（pdf.js / mammoth.js）提取文本\n- 多模态内容拼接为统一 prompt`;
  }
  if (hasImage) {
    const n = attachments.filter((a) => a.type === "image").length;
    return `收到 ${n} 张图片。${text ? `你的问题是「${text}」。\n\n` : ""}在实际产品中会调用视觉模型理解图片内容。\n\n**支持的能力：** 图片描述、OCR 文字识别、图表数据提取、物体检测\n\n> 💡 前端要点：\`URL.createObjectURL()\` 即时预览，发送时 \`FileReader.readAsDataURL()\` 转 base64。`;
  }
  if (hasFile) {
    const names = attachments.filter((a) => a.type === "file").map((a) => a.name).join("、");
    return `收到文件：${names}。${text ? `关于「${text}」，会基于文件内容回答。\n\n` : "\n\n"}**文件处理流程：**\n1. 前端分片上传（大文件断点续传）\n2. 后端按 MIME 类型选择解析器\n3. 文本切片 → Embedding → 向量数据库\n4. 用户提问时 RAG 检索相关片段`;
  }
  return "";
}
