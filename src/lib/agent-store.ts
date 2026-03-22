/* 智能体数据模型 — 模拟 Dify/Coze 的核心概念 */

export interface AgentTool {
  id: string;
  name: string;
  type: "web_search" | "code_exec" | "db_query" | "api_call" | "knowledge_base";
  enabled: boolean;
  config?: Record<string, string>;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  tools: AgentTool[];
  knowledgeBase: string[]; // 知识库名称列表
  status: "draft" | "published";
  mode: "simple" | "advanced"; // 简单模式 / 编排模式
  createdAt: number;
  updatedAt: number;
}

const AVAILABLE_TOOLS: AgentTool[] = [
  { id: "web_search", name: "网络搜索", type: "web_search", enabled: false },
  { id: "code_exec", name: "代码执行", type: "code_exec", enabled: false },
  { id: "db_query", name: "数据库查询", type: "db_query", enabled: false },
  { id: "api_call", name: "API 调用", type: "api_call", enabled: false },
  { id: "knowledge_base", name: "知识库检索", type: "knowledge_base", enabled: false },
];

export function getAvailableTools(): AgentTool[] {
  return AVAILABLE_TOOLS.map((t) => ({ ...t }));
}

/* 预置的 demo 智能体 */
export function createDemoAgents(): AgentConfig[] {
  const now = Date.now();
  return [
    {
      id: "agent-1",
      name: "客服助手",
      description: "自动回答用户常见问题，支持知识库检索和多轮对话",
      icon: "🎧",
      model: "gpt-4o",
      systemPrompt: "你是一个专业的客服助手。请根据知识库内容回答用户问题，语气友好专业。如果知识库中没有相关信息，请诚实告知用户。\n\n知识库内容：{{context}}\n用户问题：{{input}}",
      temperature: 0.3,
      maxTokens: 2048,
      tools: [
        { ...AVAILABLE_TOOLS[0], enabled: false },
        { ...AVAILABLE_TOOLS[4], enabled: true },
      ],
      knowledgeBase: ["产品FAQ", "退换货政策"],
      status: "published",
      mode: "simple",
      createdAt: now - 86400000 * 7,
      updatedAt: now - 3600000 * 2,
    },
    {
      id: "agent-2",
      name: "数据分析师",
      description: "分析业务数据，生成可视化报告，支持 SQL 查询和代码执行",
      icon: "📊",
      model: "gpt-4o",
      systemPrompt: "你是一个资深数据分析师。用户会提供数据分析需求，你需要：\n1. 理解需求并拆解分析步骤\n2. 编写 SQL 或 Python 代码\n3. 解读结果并给出业务建议\n\n用户需求：{{input}}",
      temperature: 0.5,
      maxTokens: 4096,
      tools: [
        { ...AVAILABLE_TOOLS[1], enabled: true },
        { ...AVAILABLE_TOOLS[2], enabled: true },
      ],
      knowledgeBase: [],
      status: "published",
      mode: "advanced",
      createdAt: now - 86400000 * 3,
      updatedAt: now - 86400000,
    },
    {
      id: "agent-3",
      name: "内容创作助手",
      description: "辅助撰写营销文案、社交媒体内容、产品描述等",
      icon: "✍️",
      model: "claude-3.5-sonnet",
      systemPrompt: "你是一个创意内容专家，擅长撰写各类营销文案。请根据用户的需求，生成高质量的内容。注意：\n- 语言生动有感染力\n- 符合目标平台的调性\n- 包含 CTA（行动号召）\n\n用户需求：{{input}}",
      temperature: 0.8,
      maxTokens: 2048,
      tools: [{ ...AVAILABLE_TOOLS[0], enabled: true }],
      knowledgeBase: ["品牌调性指南"],
      status: "draft",
      mode: "simple",
      createdAt: now - 86400000,
      updatedAt: now - 7200000,
    },
    {
      id: "agent-4",
      name: "投放诊断专家",
      description: "诊断广告投放效果，分析 ROI，给出优化建议",
      icon: "🔍",
      model: "deepseek-v3",
      systemPrompt: "你是一个广告投放优化专家。请根据用户提供的投放数据，进行诊断分析：\n1. 识别关键指标异常\n2. 分析可能的原因\n3. 给出具体优化建议\n\n投放数据：{{input}}\n历史基准：{{context}}",
      temperature: 0.4,
      maxTokens: 4096,
      tools: [
        { ...AVAILABLE_TOOLS[2], enabled: true },
        { ...AVAILABLE_TOOLS[3], enabled: true },
      ],
      knowledgeBase: ["投放最佳实践", "行业基准数据"],
      status: "draft",
      mode: "simple",
      createdAt: now - 3600000 * 5,
      updatedAt: now - 3600000,
    },
  ];
}

export function createEmptyAgent(): AgentConfig {
  return {
    id: `agent-${Date.now()}`,
    name: "新建智能体",
    description: "",
    icon: "🤖",
    model: "gpt-4o",
    systemPrompt: "你是一个智能助手。请根据用户的问题给出有帮助的回答。\n\n用户问题：{{input}}",
    temperature: 0.7,
    maxTokens: 2048,
    tools: getAvailableTools(),
    knowledgeBase: [],
    status: "draft",
    mode: "simple",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/* 模拟智能体对话回复 */
export function getAgentReply(agent: AgentConfig, input: string): string {
  const name = agent.name;
  const hasKB = agent.knowledgeBase.length > 0;
  const hasSearch = agent.tools.some((t) => t.type === "web_search" && t.enabled);
  const hasCode = agent.tools.some((t) => t.type === "code_exec" && t.enabled);

  if (input.includes("你是谁") || input.includes("介绍")) {
    return `我是「${name}」，${agent.description || "一个智能助手"}。\n\n我的能力包括：${agent.tools.filter((t) => t.enabled).map((t) => t.name).join("、") || "通用对话"}${hasKB ? `\n\n我还接入了知识库：${agent.knowledgeBase.join("、")}` : ""}`;
  }

  if (hasCode && (input.includes("数据") || input.includes("分析") || input.includes("查询"))) {
    return `好的，我来分析一下。\n\n**步骤 1：数据查询**\n\`\`\`sql\nSELECT date, channel, impressions, clicks, cost, conversions\nFROM ad_performance\nWHERE date >= '2026-03-01'\nORDER BY date DESC\n\`\`\`\n\n**步骤 2：计算关键指标**\n- CTR（点击率）: 2.3%（行业均值 1.8%）✅\n- CPC（单次点击成本）: ¥3.2（预算内）✅\n- 转化率: 0.8%（低于基准 1.2%）⚠️\n\n**诊断结论：** 流量质量良好，但落地页转化率偏低，建议优化落地页体验。`;
  }

  if (hasSearch && (input.includes("搜索") || input.includes("最新") || input.includes("查"))) {
    return `我帮你搜索了相关信息：\n\n🔍 **搜索结果摘要：**\n\n1. 根据最新资料显示…\n2. 相关领域的专家认为…\n3. 最新的数据表明…\n\n> 以上信息来自网络搜索，仅供参考。在实际产品中，这里会调用搜索 API 获取实时结果。`;
  }

  if (hasKB) {
    return `根据知识库「${agent.knowledgeBase[0]}」中的内容：\n\n${input.includes("退") ? "关于退换货政策：自收到商品之日起 7 天内，支持无理由退换货。请确保商品完好、包装齐全。\n\n**操作步骤：**\n1. 进入「我的订单」\n2. 选择需要退换的商品\n3. 填写退换原因\n4. 等待审核（通常 1-2 个工作日）" : "感谢你的提问。根据我的知识库，" + input + " 的相关信息如下…\n\n> 在实际产品中，这里会通过 RAG（检索增强生成）从向量数据库中检索最相关的文档片段。"}`;
  }

  return `收到你的问题：「${input}」\n\n作为${name}，我会尽力帮你解答。${agent.tools.filter((t) => t.enabled).length > 0 ? `\n\n我当前启用的工具：${agent.tools.filter((t) => t.enabled).map((t) => t.name).join("、")}` : ""}\n\n> 这是演示模式的模拟回复。在实际产品中，这里会调用 ${agent.model} 模型生成回复。`;
}
