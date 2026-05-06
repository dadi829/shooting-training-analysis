import express from 'express';
import cors from 'cors';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const PORT = process.env.PORT || 3002;
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

const RECORDS_FILE = path.join(__dirname, 'records.json');
const USERS_FILE = path.join(__dirname, 'users.json');
if (!fs.existsSync(RECORDS_FILE)) fs.writeFileSync(RECORDS_FILE, '[]');
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');

const SESSIONS = new Map();

// 数据持久化操作
function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8')); }
  catch { return []; }
}
function saveUsers(users) { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); }
function readRecords() {
  try { return JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf-8')); }
  catch { return []; }
}
function saveRecords(records) { fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2)); }

// 密码加密（Base64简单加密）
function hashPassword(password) { return Buffer.from(password).toString('base64'); }
function verifyPassword(password, hash) { return hashPassword(password) === hash; }
function generateSessionToken() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 10); }

// 认证中间件 - 验证JWT Token
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

// AI分析System Prompt - 定义输出格式和分析维度
const SYSTEM_PROMPT = `你是10米气步枪专业射击教练。分析图片，仅输出JSON，无其他文本。

输出JSON格式：
{"metadata":{"sample_id":"SHOT-xxx","firearm_type":"10米气步枪","shot_distance":8.3,"hit_coordinates":{"horizontal":0,"vertical":0},"deviation_distance":10.0,"analysis_time":"2026-01-01T00:00:00Z"},"overall_assessment":{"comprehensive_score":7,"summary":"评价","strengths":["优势1"]},"trajectory_analysis":{"pre_fire_full":{"status":"stable","issues":[],"advantages":[]},"pre_fire_05":{"status":"stable","issues":[],"advantages":[]},"post_fire":{"status":"stable","issues":[],"advantages":[]},"deviation_analysis":{"direction":"left","root_cause":"原因"}},"trigger_pressure_analysis":{"curve_features":"特征","key_issues":["问题"],"control_score":7},"improvement_suggestions":[{"priority":"high","title":"标题","practice_method":"方法"}],"confidence_level":0.9}`;

// 图像预处理 - 压缩和优化图片以提升AI分析效率和准确性
async function preprocessImageFromBuffer(buffer, options = {}) {
  const { quality = 60, maxSize = 720 } = options;
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    let { width, height } = metadata;
    
    // 等比例缩放
    if (width > maxSize || height > maxSize) {
      if (width > height) {
        height = Math.round(height * (maxSize / width));
        width = maxSize;
      } else {
        width = Math.round(width * (maxSize / height));
        height = maxSize;
      }
    }
    
    return await image
      .resize(width, height, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, progressive: true })
      .toBuffer();
  } catch (error) { 
    console.error('预处理错误:', error); 
    return buffer;
  }
}

// 根据坐标计算环数 - 10米气步枪靶纸环数计算（每环7.5mm）
function calculateRing(hit_x, hit_y) {
  try {
    if (hit_x === undefined || hit_y === undefined) return null;
    const distance = Math.sqrt(hit_x * hit_x + hit_y * hit_y);
    
    // 10米气步枪靶纸环数计算（每环半径7.5mm）
    if (distance <= 3.75) return 10.9;
    if (distance <= 7.5) return 10.5;
    if (distance <= 15) return 9.5;
    if (distance <= 22.5) return 8.5;
    if (distance <= 30) return 7.5;
    if (distance <= 37.5) return 6.5;
    if (distance <= 45) return 5.5;
    if (distance <= 52.5) return 4.5;
    if (distance <= 60) return 3.5;
    if (distance <= 67.5) return 2.5;
    if (distance <= 75) return 1.5;
    return 0.5;
  } catch (e) {
    console.error("计算环数错误", e);
    return null;
  }
}

// AI API调用 - 带重试机制的豆包大模型调用
async function callAI(imageBase64) {
  const apiKey = process.env.DOUBAO_API_KEY;
  const endpoint = process.env.DOUBAO_ENDPOINT;
  if (!apiKey) throw new Error('DOUBAO_API_KEY未配置');
  if (!endpoint) throw new Error('DOUBAO_ENDPOINT未配置');

  const requestBody = {
    model: endpoint,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: [
        { type: 'text', text: '分析这张射击靶图' },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
      ]}
    ],
    temperature: 0.25,
    top_p: 0.6,
    max_tokens: 1024
  };

  const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': `Bearer ${apiKey}` 
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API错误 ${response.status}: ${errText}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('AI响应无内容');
  
  // 提取JSON内容
  const m = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) content = m[1].trim();
  
  const firstBrace = content.indexOf('{');
  if (firstBrace === -1) return { success: false, error: 'No JSON found' };
  
  try {
    return JSON.parse(content.substring(firstBrace));
  } catch {
    return { success: false, error: 'Invalid JSON' };
  }
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
    
    // 图像预处理
    const processedBuffer = await preprocessImageFromBuffer(req.file.buffer);
    const filename = `${Date.now()}-${req.file.originalname.replace(/\.[^.]+$/, '')}.jpg`;
    const filepath = path.join(screenshotsDir, filename);
    fs.writeFileSync(filepath, processedBuffer);
    
    // 创建记录
    const record = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      userId: req.user.id,
      username: req.user.username,
      filename,
      originalFilename: req.file.originalname,
      uploadedAt: new Date().toISOString(),
      url: `/screenshots/${filename}`
    };
    
    // AI分析
    try {
      const analysis = await callAI(processedBuffer.toString('base64'));
      
      // 根据坐标计算环数
      if (analysis?.metadata?.hit_coordinates) {
        const ring = calculateRing(analysis.metadata.hit_coordinates.horizontal, analysis.metadata.hit_coordinates.vertical);
        if (ring !== null) analysis.metadata.hit_ring = ring;
      }
      
      record.analysis = analysis;
      record.analyzedAt = new Date().toISOString();
    } catch (error) {
      console.error('AI分析失败:', error);
    }
    
    // 保存记录
    const records = readRecords();
    records.unshift(record);
    saveRecords(records);
    
    res.json({ success: true, record, analysis: record.analysis });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取记录列表 - 支持角色权限过滤
app.get('/api/records', authMiddleware, (req, res) => {
  try {
    const records = readRecords();
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 12;
    
    // 根据角色过滤数据
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
    // 权限检查
    if (req.user.role === 'student' && record.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: '无权删除此记录' });
    }
    
    // 删除文件
    const filepath = path.join(screenshotsDir, record.filename);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    
    records.splice(index, 1);
    saveRecords(records);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 静态文件服务
app.use('/screenshots', express.static(screenshotsDir));

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
