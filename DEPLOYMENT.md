# 射击训练分析系统 - 部署指南

## 概述

本系统采用前后端分离架构，使用 **GitHub Pages** 托管前端静态资源，**Vercel** 托管后端 API 服务。

## 部署架构

```
┌─────────────────┐         ┌─────────────────┐
│  GitHub Pages   │         │     Vercel      │
│   (前端)        │◄───────►│   (后端 API)    │
│  React + Vite   │         │  Node + Express │
└─────────────────┘         └─────────────────┘
```

## 前置准备

1. GitHub 账号
2. Vercel 账号（可使用 GitHub 登录）
3. 豆包 API 密钥（可选，用于 AI 分析功能）

---

## 第一步：部署后端到 Vercel

### 1.1 准备代码仓库

将项目推送到 GitHub 仓库：

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

### 1.2 在 Vercel 上部署

1. 访问 [vercel.com](https://vercel.com) 并登录
2. 点击 "Add New Project"
3. 导入刚才的 GitHub 仓库
4. 配置项目设置：
   - **Project Name**: 你的项目名称
   - **Framework Preset**: 选择 "Other"
   - **Root Directory**: 保持默认
5. 在 "Environment Variables" 部分添加：
   - `DOUBAO_API_KEY`: 你的豆包 API Key（可选）
   - `DOUBAO_ENDPOINT`: 你的豆包模型端点（可选）
6. 点击 "Deploy" 开始部署

部署完成后，你会获得一个 URL，例如：`https://your-project.vercel.app`

### 1.3 验证后端

访问：`https://your-project.vercel.app/api/health`

如果返回 `{"status":"ok",...}` 说明后端部署成功！

---

## 第二步：部署前端到 GitHub Pages

### 2.1 配置 GitHub 仓库 Secrets

1. 进入 GitHub 仓库 → Settings → Secrets and variables → Actions
2. 点击 "New repository secret"
3. 添加以下 Secret：
   - **Name**: `BACKEND_URL`
   - **Value**: `https://your-project.vercel.app`（刚才 Vercel 部署的 URL，不带末尾斜杠）

### 2.2 启用 GitHub Pages

1. 进入仓库 → Settings → Pages
2. 在 "Build and deployment" 部分：
   - **Source**: 选择 "GitHub Actions"
3. 保存设置

### 2.3 触发部署

推送代码到 `main` 分支，GitHub Actions 会自动开始部署：

```bash
git add .
git commit -m "Deploy to GitHub Pages"
git push
```

### 2.4 获取访问地址

部署完成后，在仓库的 Settings → Pages 页面可以看到你的网站 URL，例如：
`https://你的用户名.github.io/仓库名/`

---

## 配置说明

### 环境变量

#### 前端（GitHub Pages）
- `VITE_BACKEND_URL`: 后端 API 地址（在 GitHub Secrets 中配置为 `BACKEND_URL`）

#### 后端（Vercel）
- `DOUBAO_API_KEY`: 豆包 API 密钥
- `DOUBAO_ENDPOINT`: 豆包模型端点（如 `ep-2024...`）

### 本地开发

创建 `.env` 文件：

```env
VITE_BACKEND_URL=http://localhost:3002
DOUBAO_API_KEY=你的API密钥
DOUBAO_ENDPOINT=你的模型端点
```

启动：
```bash
# 后端
cd src/backend
npm install
node server.js

# 前端（新终端）
npm install
npm run dev
```

---

## 注意事项

1. **数据存储**: 由于 Vercel Serverless Functions 的特性，当前使用内存存储，应用重启后数据会丢失。如需持久化，建议集成 Supabase、Firebase 或其他数据库服务。

2. **GitHub Pages 限制**:
   - 单个仓库最大 1GB
   - 月带宽软限制 100GB
   - 每小时最多 10 次构建

3. **Vercel 免费额度**:
   - 每月 100GB 带宽
   - 100GB-Hours 函数运行时间
   - 足够中小规模使用

4. **自定义域名**: 两个平台都支持绑定自定义域名。

---

## 快速测试部署

### 使用演示模式（无需 API Key）

如果没有豆包 API Key，系统仍可运行，但 AI 分析会返回模拟结果。

### 创建测试账号

1. 访问你的 GitHub Pages URL
2. 注册一个教练账号
3. 使用该账号登录

---

## 故障排查

### 前端无法连接后端
- 检查 `VITE_BACKEND_URL` 是否配置正确
- 确保后端已成功部署
- 检查浏览器控制台的网络请求

### GitHub Actions 部署失败
- 检查 Secrets 是否正确配置
- 查看 Actions 日志中的错误信息

### Vercel 部署失败
- 查看 Vercel 部署日志
- 确保环境变量已正确设置
- 检查 package.json 中的依赖

---

## 技术栈

| 层级 | 技术 | 托管 |
|------|------|------|
| 前端 | React 18 + TypeScript + Vite + Ant Design | GitHub Pages |
| 后端 | Node.js + Express | Vercel |
| AI | 字节跳动豆包 API | 外部服务 |

---

## 替代方案

如果不想使用 Vercel，后端也可以部署到：
- **Railway** (https://railway.app)
- **Render** (https://render.com)
- **Fly.io** (https://fly.io)

这些平台都提供免费额度，部署流程类似。
