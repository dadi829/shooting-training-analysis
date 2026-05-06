const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const PORT = process.env.PORT || 3002;
const tmpDir = path.join('/tmp', 'screenshots');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

// 内存数据存储（Vercel 无持久化文件系统）
let RECORDS = [];
let USERS = [];
const SESSIONS = new Map();

// 初始化默认管理员
if (USERS.length === 0) {
  USERS.push({
    id: 'admin',
    username: 'admin',
    password: Buffer.from('admin123').toString('base64'),
    role: 'coach',
    createdAt: new Date().toISOString()
  });
}

// 数据操作
function readUsers() { return USERS; }
function saveUsers(users) { USERS = users; }
function readRecords() { return RECORDS; }
function saveRecords(records) { RECORDS = records; }

// 密码加密（Base64简单加密）
function hashPassword(password) { return Buffer.from(password).toString('base64'); }
function verifyPassword(password, hash) { return hashPassword(password) === hash; }
function generateSessionToken() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 10); }

// 认证中间件
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: '未登录或会话已过期' });
  }
  const token = authHeader.substring(7);
  const session = SESSIONS.get(token);
  if (!session || session.expiresAt < Date.now()) {
    SESSIONS.delete(token);
    return res.status(401).json({ success: false, error: '未登录或会话已过期' });
  }
  req.user = session.user;
  req.sessionToken = token;
  next();
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// 模拟AI分析（无API Key时使用）
function generateMockAnalysis() {
  const score = 7 + Math.random() * 3.9;
  const ring = 8 + Math.random() * 2.9;
  const hitX = (Math.random() - 0.5) * 20;
  const hitY = (Math.random() - 0.5) * 20;
  return {
    metadata: {
      sample_id: 'SHOT-' + Date.now().toString(36),
      firearm_type: '10米气步枪',
      shot_distance: 8.3,
      hit_coordinates: { horizontal: hitX, vertical: hitY },
      hit_ring: ring,
      deviation_distance: Math.sqrt(hitX * hitX + hitY * hitY),
      analysis_time: new Date().toISOString()
    },
    overall_assessment: {
      comprehensive_score: Math.round(score),
      summary: '射击姿势基本稳定，击发时机把控较好，但瞄准点有轻微偏移',
      strengths: ['姿势稳定', '呼吸控制良好']
    },
    trajectory_analysis: {
      pre_fire_full: { status: 'stable', issues: [], advantages: ['姿势稳定'] },
      pre_fire_05: { status: 'stable', issues: [], advantages: [] },
      post_fire: { status: 'stable', issues: [], advantages: ['跟进动作标准'] },
      deviation_analysis: { direction: hitX > 0 ? 'right' : 'left', root_cause: '手腕轻微晃动' }
    },
    trigger_pressure_analysis: {
      curve_features: '均匀平稳',
      key_issues: ['最后用力阶段有轻微抖动'],
      control_score: Math.round(score)
    },
    improvement_suggestions: [
      { priority: 'high', title: '加强手腕稳定性训练', practice_method: '每日进行10分钟手腕力量训练' },
      { priority: 'medium', title: '优化瞄准点控制', practice_method: '增加空枪预习次数' }
    ],
    confidence_level: 0.85
  };
}

// ==================== API路由 ====================

// 健康检查
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// 用户注册
app.post('/api/auth/register', (req, res) => {
  try {
    const { username, password, role, coachId } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ success: false, error: '用户名、密码和角色不能为空' });
    }
    if (role === 'student' && !coachId) {
      return res.status(400).json({ success: false, error: '学员需要关联教练' });
    }
    
    const users = readUsers();
    if (users.find(u => u.username === username)) {
      return res.status(400).json({ success: false, error: '用户名已存在' });
    }
    
    const newUser = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      username,
      password: hashPassword(password),
      role,
      coachId: role === 'student' ? coachId : undefined,
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    saveUsers(users);
    res.json({ success: true, user: { id: newUser.id, username: newUser.username, role: newUser.role } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 用户登录
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const users = readUsers();
    const user = users.find(u => u.username === username);
    
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ success: false, error: '用户名或密码错误' });
    }
    
    const token = generateSessionToken();
    SESSIONS.set(token, { user: { id: user.id, username: user.username, role: user.role, coachId: user.coachId }, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
    
    res.json({ success: true, token, user: { id: user.id, username: user.username, role: user.role, coachId: user.coachId } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取教练列表
app.get('/api/coaches', (req, res) => {
  try {
    const users = readUsers();
    const coaches = users.filter(u => u.role === 'coach').map(u => ({ id: u.id, username: u.username }));
    res.json({ success: true, coaches });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取教练的学员列表
app.get('/api/coach/students', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'coach') {
      return res.status(403).json({ success: false, error: '只有教练可以查看学员列表' });
    }
    const users = readUsers();
    const students = users.filter(u => u.role === 'student' && u.coachId === req.user.id);
    res.json({ success: true, students });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 上传图片并AI分析
app.post('/api/records', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: '未上传文件' });
    
    // 创建记录
    const record = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      userId: req.user.id,
      username: req.user.username,
      filename: `${Date.now()}.jpg`,
      originalFilename: req.file.originalname,
      uploadedAt: new Date().toISOString()
    };
    
    // 使用模拟AI分析
    const analysis = generateMockAnalysis();
    record.analysis = analysis;
    record.analyzedAt = new Date().toISOString();
    
    // 保存记录
    const records = readRecords();
    records.unshift(record);
    saveRecords(records);
    
    res.json({ success: true, record, analysis: record.analysis });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取记录列表
app.get('/api/records', authMiddleware, (req, res) => {
  try {
    const records = readRecords();
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 12;
    
    let filtered = records;
    if (req.user.role === 'student') {
      filtered = records.filter(r => r.userId === req.user.id);
    } else if (req.user.role === 'coach') {
      const users = readUsers();
      const studentIds = users.filter(u => u.coachId === req.user.id).map(u => u.id);
      filtered = records.filter(r => r.userId === req.user.id || studentIds.includes(r.userId));
    }
    
    const start = (page - 1) * pageSize;
    res.json({ 
      success: true, 
      records: filtered.slice(start, start + pageSize), 
      total: filtered.length, 
      page, 
      pageSize 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除记录
app.delete('/api/records/:id', authMiddleware, (req, res) => {
  try {
    const records = readRecords();
    const index = records.findIndex(r => r.id === req.params.id);
    if (index === -1) return res.status(404).json({ success: false, error: '记录不存在' });
    
    const record = records[index];
    if (req.user.role === 'student' && record.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: '无权删除此记录' });
    }
    
    records.splice(index, 1);
    saveRecords(records);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = app;
