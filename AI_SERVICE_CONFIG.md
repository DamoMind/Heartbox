# AI Service Configuration

## Overview

本项目使用双层 AI 服务架构，确保服务可用性和成本控制。

## 架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                     AI 服务访问流程                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐     检查配额        ┌─────────────────────────┐ │
│  │   前端 App   │ ──────────────────> │  /api/ai/quota          │ │
│  └─────────────┘                      │  返回: 剩余次数/警告状态  │ │
│         │                             └─────────────────────────┘ │
│         │ AI请求                                                  │
│         ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   donation-inventory-api                     │ │
│  │  ┌─────────────────────────────────────────────────────────┐│ │
│  │  │ 使用量 < 80% ──> Cloudflare Workers AI (免费)           ││ │
│  │  │   • @cf/meta/llama-3.1-8b-instruct (文本分类)           ││ │
│  │  │   • @cf/llava-hf/llava-1.5-7b-hf (图像识别)             ││ │
│  │  └─────────────────────────────────────────────────────────┘│ │
│  │  ┌─────────────────────────────────────────────────────────┐│ │
│  │  │ 使用量 >= 80% ──> Edge AI Gateway ──> Azure GPT-4o      ││ │
│  │  │   (安全代理，API Key 存储在 Cloudflare Secrets)          ││ │
│  │  └─────────────────────────────────────────────────────────┘│ │
│  │  ┌─────────────────────────────────────────────────────────┐│ │
│  │  │ 使用量 = 100% ──> 返回 quotaExhausted: true             ││ │
│  │  └─────────────────────────────────────────────────────────┘│ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## 服务配置

### 1. Cloudflare Workers AI (主要)

**绑定配置** (`backend/wrangler.toml`):
```toml
[ai]
binding = "AI"
```

**使用的模型**:
| 模型 | 用途 | 说明 |
|------|------|------|
| `@cf/meta/llama-3.1-8b-instruct` | 条形码分类 | 根据条形码猜测商品类别 |
| `@cf/llava-hf/llava-1.5-7b-hf` | 图像识别 | 识别物品图片，提取名称/类别 |

**免费额度**: 10,000 神经元/天

### 2. Azure AI (备用)

通过 Edge AI Gateway 代理访问，API Key 安全存储在 Cloudflare Secrets。

**Edge AI Gateway**:
- URL: Configure via `EDGE_AI_GATEWAY_URL` in wrangler.toml
- 使用模型: Azure GPT-4o (支持视觉)

**Azure 配置** (set as secrets, not in code):
```bash
# Set these via wrangler secret or Edge AI Gateway config
AZURE_OPENAI_API_KEY="<your-azure-api-key>"
AZURE_OPENAI_API_BASE="<your-azure-endpoint>"
AZURE_OPENAI_API_VERSION="2025-01-01-preview"
AZURE_OPENAI_API_DEPLOYMENT_NAME="<your-deployment-name>"
```

> ⚠️ **Never commit actual API keys to the repository!**

## 配额管理

### 配置参数

**后端配置** (`backend/wrangler.toml`):
```toml
[vars]
CORS_ORIGIN = "*"
EDGE_AI_GATEWAY_URL = "https://edge-ai-gateway.unitecore.workers.dev"
AI_DAILY_LIMIT = "1000"
AI_WARNING_THRESHOLD = "100"
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `AI_DAILY_LIMIT` | 1000 | 每日最大 AI 请求次数 |
| `AI_WARNING_THRESHOLD` | 100 | 剩余次数低于此值时显示警告 |

### 切换策略

| 使用量 | 服务提供商 | 说明 |
|--------|------------|------|
| 0-80% | Cloudflare Workers AI | 免费，速度快 |
| 80-100% | Azure GPT-4o | 付费备用，通过 Edge AI Gateway |
| 100% | 拒绝服务 | 返回 `quotaExhausted: true` |

### 数据库表

**ai_usage** (使用量追踪):
```sql
CREATE TABLE ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,                    -- 日期 YYYY-MM-DD
  provider TEXT NOT NULL,                -- 'cloudflare' 或 'azure'
  endpoint TEXT NOT NULL,                -- 'barcode_lookup' 或 'image_recognition'
  request_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(date, provider, endpoint)
);
```

## API 端点

### 配额状态查询

```bash
GET /api/ai/quota
```

**响应示例**:
```json
{
  "date": "2026-01-17",
  "used": 150,
  "limit": 1000,
  "remaining": 850,
  "warningThreshold": 100,
  "isWarning": false,
  "isExhausted": false,
  "provider": "cloudflare",
  "breakdown": {
    "cloudflare": 120,
    "azure": 30
  }
}
```

### 条形码查询 (带 AI 分类)

```bash
GET /api/barcode/lookup/{barcode}
```

**数据源优先级**:
1. Open Food Facts API (免费数据库)
2. UPCitemdb API (免费数据库)
3. AI 分类 (Cloudflare 或 Azure)

### 图像识别

```bash
POST /api/ai/recognize
Content-Type: application/json

{
  "image": "data:image/jpeg;base64,..."
}
```

**响应**:
```json
{
  "name": "Baby Shampoo",
  "category": "hygiene",
  "unit": "bottles",
  "barcode": null,
  "generatedBarcode": "KCLZ8X9Y2ABC",
  "confidence": 0.85,
  "description": "Baby shampoo bottle",
  "quotaExhausted": false
}
```

## 前端警告显示

### 警告级别

| 状态 | 颜色 | 触发条件 |
|------|------|----------|
| 正常 | 无 | remaining > warningThreshold |
| 警告 | 黄色 | 0 < remaining <= warningThreshold |
| 耗尽 | 红色 | remaining = 0 |

### 翻译键

**英文** (`src/i18n/en.json`):
```json
{
  "scan": {
    "quotaWarning": "AI usage running low",
    "quotaWarningDetail": "{{remaining}} of {{limit}} AI requests remaining today",
    "quotaExhausted": "AI quota exhausted",
    "quotaExhaustedDetail": "Daily AI limit reached. Please enter item details manually.",
    "usingAzure": "Using Azure AI (backup)"
  }
}
```

**中文** (`src/i18n/zh.json` - 如需添加):
```json
{
  "scan": {
    "quotaWarning": "AI 使用量即将耗尽",
    "quotaWarningDetail": "今日剩余 {{remaining}}/{{limit}} 次 AI 请求",
    "quotaExhausted": "AI 配额已耗尽",
    "quotaExhaustedDetail": "今日 AI 限额已用完，请手动输入物品信息",
    "usingAzure": "使用 Azure AI (备用)"
  }
}
```

## 部署命令

### 后端部署

```bash
cd backend
npx wrangler deploy
```

### 前端部署

```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name <your-project-name>
```

### Edge AI Gateway 部署

If using a separate Edge AI Gateway:

```bash
# Set Azure API Key (first time)
npx wrangler secret put AZURE_API_KEY

# Deploy
npx wrangler deploy
```

## 数据库迁移

迁移文件位于 `backend/migrations/`:

| 文件 | 说明 |
|------|------|
| `001_init.sql` | 初始表结构 |
| `002_remove_fk_constraints.sql` | 移除外键约束 |
| `003_ai_usage_tracking.sql` | AI 使用量追踪表 |

**执行迁移**:
```bash
cd backend
npx wrangler d1 execute donation-inventory-db --remote --file=migrations/003_ai_usage_tracking.sql
```

## 监控与调试

### 查看当日使用量

```bash
curl -s https://donation-inventory-api.unitecore.workers.dev/api/ai/quota | jq .
```

### 查看 Worker 日志

```bash
npx wrangler tail donation-inventory-api
```

### 测试 Edge AI Gateway

```bash
curl -X POST https://edge-ai-gateway.unitecore.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"max_tokens":50}'
```

## 成本估算

| 服务 | 免费额度 | 超出费用 |
|------|----------|----------|
| Cloudflare Workers AI | 10,000 神经元/天 | $0.011/1000 神经元 |
| Azure GPT-4o | 无 | ~$0.005/1K input tokens |

**日均成本预估** (1000 次请求):
- 80% Cloudflare (免费): $0
- 20% Azure (~$0.005 × 200): ~$1/天

## 故障排除

### AI 识别失败

1. 检查配额: `GET /api/ai/quota`
2. 检查 Edge AI Gateway 健康: `POST https://edge-ai-gateway.unitecore.workers.dev`
3. 查看 Worker 日志: `npx wrangler tail`

### 配额重置

配额每日 UTC 0:00 自动重置 (基于 `ai_usage.date` 字段)。

### 手动清理使用量 (仅测试)

```sql
DELETE FROM ai_usage WHERE date = '2026-01-17';
```
