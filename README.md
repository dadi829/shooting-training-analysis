# 射击训练分析管理系统

## 项目简介

基于Web的射击训练分析管理平台，采用前后端分离架构，集成AI大模型API实现智能分析。系统支持教练端/学员端角色分离，提供靶面图片上传、AI智能分析、历史记录管理、数据可视化等功能。

## 技术栈

- **前端**: React 18 + TypeScript + Vite + Ant Design + ECharts
- **后端**: Node.js + Express + Multer + Sharp
- **AI服务**: 字节跳动豆包大模型API

## 快速开始

### 环境要求
- Node.js 16+
- 4GB+ 内存

### 安装运行

```bash
# 1. 安装前端依赖
npm install

# 2. 安装后端依赖
cd src/backend
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，添加 DOUBAO_API_KEY

# 4. 启动后端服务
npm start

# 5. 启动前端开发服务器（新终端）
cd ../..
npm run dev
```

访问 http://localhost:5173 使用系统。

## 项目结构

```
src/
├── App.tsx          # 主应用组件
├── main.tsx         # 应用入口
├── backend/
│   ├── server.js    # 后端服务
│   └── package.json # 后端依赖
└── ...
```

## 核心功能

1. **用户系统**: 教练/学员注册登录，角色权限管理
2. **AI分析**: 靶面环数识别、姿势分析、个性化建议
3. **历史记录**: 训练记录管理、筛选搜索、CSV导出
4. **数据可视化**: 成绩趋势图表、统计看板

## 许可证

MIT
