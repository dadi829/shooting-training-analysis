import express from 'express';
import cors from 'cors';
import multer from 'multer';
import sharp from 'sharp';
import fetch from 'node-fetch';

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const PORT = process.env.PORT || 3002;
const SESSIONS = new Map();

// 内存存储用户和记录（生产环境应使用数据库）
let users = [];
let records = [];

// 简单的密码加密
const hashPassword = (password) => Buffer.from(password).toString('base64');
const verifyPassword = (password, hash) => hashPassword(password) === hash;

// 生成会话token
const generateSessionToken = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 10);

// 认证中间件
const authMiddleware = (req, res, next) => {
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
};

// 图像预处理
const preprocessImage = async (buffer) => {
  try {
    return await sharp(buffer)
      .resize(720, 720, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 60, progressive: true })
      .toBuffer();
  } catch (error) {
    console.error('preprocess error:', error);
    return buffer;
  }
};

// 计算环数
const calculateRing = (hit_x, hit_y) => {
  if (hit_x === undefined || hit_y === undefined) return null;
  const distance = Math.sqrt(hit_x * hit_x + hit_y * hit_y);
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
};

// 模拟AI分析结果
const generateMockAnalysis = () => {
  const ringScores = [10.9, 10.5, 10.2, 9.8, 9.5, 9.2, 8.8, 8.5];
  const hitRing = ringScores[Math.floor(Math.random() * ringScores.length)];
  const hitX = (Math.random() - 0.5) * 30;
  const hitY = (Math.random() - 0.5) * 30;

  return {
    metadata: {
      sample_id: "SHOT-" + Date.now().toString(36).toUpperCase(),
      firearm_type: "10米气步枪",
      shot_distance: 8.3,
      hit_coordinates: { horizontal: hitX, vertical: hitY },
      deviation_distance: Math.sqrt(hitX * hitX + hitY * hitY),
      hit_ring: hitRing
    },
    overall_assessment: {
      comprehensive_score: Math.floor(6 + Math.random() * 4),
      summary: hitRing >= 10 ? "优秀！接近靶心" : hitRing >= 9 ? "良好，表现稳定" : "有提升空间",
      strengths: ["姿势稳定", "瞄准准确", "击发果断"].slice(0, 2 + Math.floor(Math.random() * 2))
    },
    trajectory_analysis: {
      pre_fire_full: { status: "stable", issues: [], advantages: ["瞄准轨迹平稳"] },
      pre_fire_05: { status: "stable", issues: [], advantages: ["最后阶段稳定"] },
      post_fire: { status: "good", issues: [], advantages: ["复位自然"] },
      deviation_analysis: {
        direction: hitX > 0 ? "right" : hitX < 0 ? "left" : "center",
        root_cause: "轻微的手腕抖动"
      }
    },
    improvement_suggestions: [
      { priority: hitRing >= 10 ? "medium" : "high", title: "呼吸控制", practice_method: "加强击发前的呼吸稳定性训练" },
      { priority: "medium", title: "瞄准点保持", practice_method: "在瞄准过程中保持稳定的瞄准点" }
    ]
  };
};

// AI分析
const callAI = async (imageBase64) => {
  const apiKey = process.env.DOUBAO_API_KEY;
  const endpoint = process.env.DOUBAO_ENDPOINT;
  
  // 如果没有配置API Key，使用模拟模式
  if (!apiKey || !endpoint) {
    console.log('使用模拟AI分析模式');
    return generateMockAnalysis();
  }

  const SYSTEM_PROMPT = `你是10米气步枪专业射击教练。分析图片，仅输出JSON，无其他文本。
颜色定义：- 红色轨迹：击发前完整瞄准轨迹 - 蓝色轨迹：击发前0.5秒关键轨迹 - 绿色轨迹：击发后复位轨迹 - 紫色点：弹孔位置
输出JSON格式：{"metadata":{"sample_id":"SHOT-001","firearm_type":"10米气步枪","shot_distance":8.3,"hit_coordinates":{"horizontal":0,"vertical":0},"deviation_distance":5.0},"overall_assessment":{"comprehensive_score":8,"summary":"射击表现良好","strengths":["稳定性好","姿势标准"]},"improvement_suggestions":[{"priority":"high","title":"呼吸控制","practice_method":"加强击发前的呼吸稳定性训练"}]}
`;

  try {
    const res = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: endpoint,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: [
            { type: 'text', text: '分析这张射击靶图' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
          ]}
        ],
        temperature: 0.25,
        max_tokens: 1024
      })
    });

    const data = await res.json();
    let content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('AI响应无内容');

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.metadata?.hit_coordinates) {
        parsed.metadata.hit_ring = calculateRing(
          parsed.metadata.hit_coordinates.horizontal,
          parsed.metadata.hit_coordinates.vertical
        );
      }
      return parsed;
    }
    return { success: false, error: '无法解析AI响应' };
  } catch (error) {
    console.error('AI调用失败，使用模拟模式:', error);
    return generateMockAnalysis();
  }
};

// 健康检查
app.get('/api/health', (req, res) => {
  const hasAIConfig = !!(process.env.DOUBAO_API_KEY && process.env.DOUBAO_ENDPOINT);
  res.json({
    status: 'ok',
    mode: hasAIConfig ? 'AI' : 'Mock',
    time: new Date().toISOString(),
    message: hasAIConfig ? 'AI服务已配置' : '使用模拟模式'
  });
});

// 用户注册
app.post('/api/auth/register', (req, res) => {
  try {
    const { username, password, role, coachId } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ success: false, error: '用户名、密码和角色不能为空' });
    }
    if (role !== 'coach' && role !== 'student') {
      return res.status(400).json({ success: false, error: '角色必须是coach或student' });
    }
    if (role === 'student' && !coachId) {
      return res.status(400).json({ success: false, error: '学员需要关联教练' });
    }
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
    const { password: _, ...userWithoutPassword } = newUser;
    res.json({ success: true, user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ success: false, error: '注册失败' });
  }
});

// 用户登录
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ success: false, error: '用户名或密码错误' });
    }
    const token = generateSessionToken();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    SESSIONS.set(token, { user, expiresAt });
    const { password: _, ...userWithoutPassword } = user;
    res.json({ success: true, user: userWithoutPassword, token, expiresAt: new Date(expiresAt).toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, error: '登录失败' });
  }
});

// 用户登出
app.post('/api/auth/logout', authMiddleware, (req, res) => {
  SESSIONS.delete(req.sessionToken);
  res.json({ success: true });
});

// 获取当前用户
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const { password: _, ...userWithoutPassword } = req.user;
  res.json({ success: true, user: userWithoutPassword });
});

// 获取教练列表
app.get('/api/coaches', (req, res) => {
  const coaches = users.filter(u => u.role === 'coach').map(({ password, ...c }) => c);
  res.json({ success: true, coaches });
});

// 获取学员列表
app.get('/api/coach/students', authMiddleware, (req, res) => {
  if (req.user.role !== 'coach') {
    return res.status(403).json({ success: false, error: '只有教练可以访问' });
  }
  const students = users.filter(u => u.role === 'student' && u.coachId === req.user.id).map(({ password, ...s }) => s);
  res.json({ success: true, students });
});

// Multer配置
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// 上传并分析
app.post('/api/records', authMiddleware, upload.any(), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    const file = req.files[0];
    const processedBuffer = await preprocessImage(file.buffer);
    
    const record = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      userId: req.user.id,
      username: req.user.username,
      filename: `${Date.now()}-${file.originalname}`,
      originalFilename: file.originalname,
      uploadedAt: new Date().toISOString(),
      imageBase64: processedBuffer.toString('base64')
    };

    const analysis = await callAI(processedBuffer.toString('base64'));
    record.analysis = analysis;
    record.analyzedAt = new Date().toISOString();
    records.unshift(record);

    res.json({ success: true, record, analysis });
  } catch (error) {
    console.error('Upload failed:', error);
    res.status(500).json({ success: false, error: 'Upload failed: ' + error.message });
  }
});

// 获取记录
app.get('/api/records', authMiddleware, (req, res) => {
  try {
    let filteredRecords = records;
    if (req.user.role === 'student') {
      filteredRecords = records.filter(r => r.userId === req.user.id);
    } else if (req.user.role === 'coach') {
      const studentIds = users.filter(u => u.role === 'student' && u.coachId === req.user.id).map(u => u.id);
      studentIds.push(req.user.id);
      filteredRecords = records.filter(r => studentIds.includes(r.userId));
    }
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 12;
    const start = (page - 1) * pageSize;
    res.json({ 
      success: true, 
      records: filteredRecords.slice(start, start + pageSize).map(r => ({
        ...r,
        url: r.imageBase64 ? `data:image/jpeg;base64,${r.imageBase64}` : null
      })), 
      total: filteredRecords.length, 
      page, 
      pageSize 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取记录失败' });
  }
});

// 删除记录
app.delete('/api/records/:id', authMiddleware, (req, res) => {
  const index = records.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Record not found' });
  if (records[index].userId !== req.user.id) {
    return res.status(403).json({ success: false, error: '无权删除此记录' });
  }
  records.splice(index, 1);
  res.json({ success: true });
});

// Vercel serverless handler
module.exports = app;

// 本地运行支持
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
    console.log(`📊 模式: ${process.env.DOUBAO_API_KEY && process.env.DOUBAO_ENDPOINT ? 'AI' : 'Mock'}`);
  });
}
