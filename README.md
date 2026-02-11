# Stock MultiAgent Discussion System

多 Agent 股票讨论系统 - 重大决定的 AI 顾问团

## 功能特性

- 🤖 多个 AI Agent 参与讨论（涨停敢死队长、价值投资苦行僧、量化狙击手、草根股神老王）
- 💬 多轮讨论，每轮都有发言和互评
- 📊 自动生成每轮总结，包括共识、分歧、关键洞察
- 📝 会话总结，生成完整的讨论报告

## 技术栈

- **前端**: Next.js 14 (App Router) + React + TypeScript + Tailwind CSS
- **后端**: Next.js API Routes
- **LLM**: 抽象 LLM Client（当前使用 Mock，可替换为 OpenAI）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 OpenAI API（可选）

如果要使用真实的 AI 模型进行讨论，需要配置 OpenAI API Key：

1. 复制环境变量示例文件：
```bash
cp .env.local.example .env.local
```

2. 编辑 `.env.local` 文件，填入你的 OpenAI API Key：
```env
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4o-mini
```

3. 获取 API Key：
   - 访问 [OpenAI Platform](https://platform.openai.com/api-keys)
   - 登录并创建新的 API Key
   - 将 Key 填入 `.env.local` 文件

**注意**：如果不配置 API Key，系统会使用 Mock LLM Client（返回模拟数据），适合本地开发和测试。

### 3. 运行开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看应用。

### 3. 构建生产版本

```bash
npm run build
npm start
```

## 项目结构

```
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── sessions/      # 会话管理
│   │   ├── rounds/        # 轮次讨论
│   │   └── summaries/     # 会话总结
│   ├── layout.tsx         # 根布局
│   ├── page.tsx           # 主页面
│   └── globals.css        # 全局样式
├── components/            # React 组件
│   ├── WelcomePage.tsx    # 欢迎页
│   ├── NewDiscussionPage.tsx  # 新建讨论页
│   └── DiscussionPage.tsx     # 讨论页
├── lib/                   # 业务逻辑
│   ├── discussionService.ts   # 讨论服务
│   ├── llmClient.ts          # LLM 客户端
│   └── utils.ts              # 工具函数
├── prompts/               # Prompt 模板
│   ├── agents.ts          # Agent 配置
│   ├── builder.ts         # Prompt 构建器
│   ├── roundAgentPrompts.ts   # 轮次 Agent Prompts
│   ├── roundSummaryPrompts.ts # 轮次总结 Prompts
│   └── sessionSummaryPrompts.ts # 会话总结 Prompts
└── types/                 # TypeScript 类型定义
```

## 使用说明

1. **创建讨论**: 点击欢迎页的编辑按钮或输入框，进入新建讨论页
2. **选择 Agent**: 至少选择 3 个 Agent 参与讨论
3. **输入话题**: 填写讨论话题和背景说明
4. **开始讨论**: 点击"开始讨论"按钮，系统会自动运行第一轮讨论
5. **继续讨论**: 在讨论页面点击"Continue discussion..."可以继续下一轮
6. **查看总结**: 点击"回到底部"按钮查看完整的讨论总结

## 配置 LLM Client

系统已自动支持 OpenAI API。根据环境变量自动选择：

- **有 `OPENAI_API_KEY`**：使用真实的 OpenAI API
- **无 `OPENAI_API_KEY`**：使用 Mock LLM Client（模拟数据）

### 环境变量配置

在 `.env.local` 文件中可以配置以下选项：

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `OPENAI_API_KEY` | OpenAI API Key（必需） | - |
| `OPENAI_MODEL` | 使用的模型 | `gpt-4o-mini` |
| `OPENAI_BASE_URL` | API Base URL（可选，用于代理） | OpenAI 官方地址 |
| `OPENAI_MAX_TOKENS` | 最大生成 token 数 | `2000` |
| `OPENAI_TEMPERATURE` | 温度参数（0.0-2.0） | `0.7` |

### 推荐模型

- **gpt-4o-mini**：性价比高，速度快，适合大多数场景（推荐）
- **gpt-4o**：更强的能力，适合复杂讨论
- **gpt-4-turbo**：平衡性能和成本
- **gpt-3.5-turbo**：更便宜但能力较弱

### 使用其他兼容 OpenAI API 的服务

如果你使用其他兼容 OpenAI API 的服务（如 Azure OpenAI、其他代理服务），只需设置 `OPENAI_BASE_URL`：

```env
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://your-api-endpoint.com/v1
```

## 开发注意事项

- 所有 Prompt 模板使用 `{{变量名}}` 占位符
- API Routes 使用 Next.js App Router 格式
- 前端组件使用 'use client' 指令标记客户端组件
- 类型定义集中在 `types/index.ts`

## License

MIT
