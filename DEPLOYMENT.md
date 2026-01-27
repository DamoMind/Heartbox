# Heartbox 部署指南

## 线上环境

| 组件 | 名称 | URL |
|------|------|-----|
| **前端 (Pages)** | `heartbox` | https://heartbox.pages.dev |
| **自定义域名** | - | https://donate.duku.app |
| **后端 (Worker)** | `donation-inventory-api` | https://donation-inventory-api.unitecore.workers.dev |
| **数据库 (D1)** | `donation-inventory-db` | ID: `e34f809d-45c4-41ca-ba6b-277630eb6e0c` |

## 部署命令

### 前端部署
```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name=heartbox --commit-dirty=true
```

### 后端部署
```bash
cd backend
npm run deploy
# 或者
npx wrangler deploy
```

### 数据库迁移
```bash
cd backend
# 本地测试
npx wrangler d1 execute donation-inventory-db --file=./migrations/XXX.sql

# 远程执行
npx wrangler d1 execute donation-inventory-db --remote --file=./migrations/XXX.sql
```

## ⚠️ 注意事项

1. **不要创建新项目** - 使用现有的 `heartbox` 和 `donation-inventory-api`
2. **D1 数据库 ID** 已配置在 `backend/wrangler.toml`
3. **自定义域名** `donate.duku.app` 已绑定到 `heartbox`

## Cloudflare 账号

- Account ID: `a1ccbc30ed0501ad6788afd7757140a5`
- Email: wkingfly@gmail.com
