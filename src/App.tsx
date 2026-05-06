import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  Layout, Menu, Card, List, Image, Button, Pagination, Modal, message, Typography, 
  Spin, Empty, Tag, Row, Col, Upload, Collapse, Form, 
  Input, Select, Tabs, Space, DatePicker, InputNumber, Statistic
} from 'antd';
import { 
  DeleteOutlined, PictureOutlined, HistoryOutlined, ReloadOutlined, RobotOutlined, 
  UploadOutlined, CheckCircleFilled, UserOutlined, LogoutOutlined,
  BarChartOutlined, TeamOutlined, SearchOutlined, DownloadOutlined, FilterOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import ReactECharts from 'echarts-for-react';
import './App.css';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;
const { Panel } = Collapse;
const { Option } = Select;

const BACKEND_URL = (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:3002';

// 系统状态类型
interface SystemStatus {
  status: string;
  mode: 'AI' | 'Mock';
  message: string;
  time: string;
}

// 用户类型定义
interface User {
  id: string;
  username: string;
  role: 'coach' | 'student';
  coachId?: string;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, role: 'coach' | 'student', coachId?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 认证Provider - 管理用户登录状态和持久化
const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true
  });

  // 从localStorage恢复登录状态
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');
    
    if (savedUser && savedToken) {
      try {
        setState({
          user: JSON.parse(savedUser),
          token: savedToken,
          isLoading: false
        });
      } catch {
        setState({ user: null, token: null, isLoading: false });
      }
    } else {
      setState({ user: null, token: null, isLoading: false });
    }
  }, []);

  const login = async (username: string, password: string) => {
    const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    
    if (data.success) {
      setState({ user: data.user, token: data.token, isLoading: false });
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
      message.success('登录成功');
    } else {
      throw new Error(data.error || '登录失败');
    }
  };

  const register = async (username: string, password: string, role: 'coach' | 'student', coachId?: string) => {
    const res = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role, coachId })
    });
    const data = await res.json();
    
    if (data.success) {
      message.success('注册成功，请登录');
    } else {
      throw new Error(data.error || '注册失败');
    }
  };

  const logout = () => {
    setState({ user: null, token: null, isLoading: false });
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    message.info('已退出登录');
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// 训练记录类型定义
interface ShotRecord {
  id: string;
  userId: string;
  username?: string;
  filename: string;
  originalFilename: string;
  uploadedAt: string;
  url: string;
  analysis?: any;
  analyzedAt?: string;
}

// 登录/注册页面
const AuthPage: React.FC = () => {
  const { login, register } = useAuth();
  const [activeTab, setActiveTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [coaches, setCoaches] = useState<User[]>([]);

  // 加载教练列表供学员选择
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/coaches`)
      .then(res => res.json())
      .then(data => { if (data.success) setCoaches(data.coaches); })
      .catch(console.error);
  }, []);

  const handleLogin = async (values: any) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: any) => {
    setLoading(true);
    try {
      await register(values.username, values.password, values.role, values.coachId);
      setActiveTab('login');
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0 }}>🎯 射击训练分析</Title>
          <Text type="secondary">智能训练管理系统</Text>
        </div>
        
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab} 
          centered
          items={[
            {
              key: 'login',
              label: '登录',
              children: (
                <Form onFinish={handleLogin} layout="vertical">
                  <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
                    <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
                  </Form.Item>
                  <Form.Item name="password" label="密码" rules={[{ required: true }]}>
                    <Input.Password prefix={<UserOutlined />} placeholder="请输入密码" />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading} block size="large">
                      登录
                    </Button>
                  </Form.Item>
                </Form>
              )
            },
            {
              key: 'register',
              label: '注册',
              children: (
                <Form onFinish={handleRegister} layout="vertical">
                  <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
                    <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
                  </Form.Item>
                  <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}>
                    <Input.Password prefix={<UserOutlined />} placeholder="请输入密码（至少6位）" />
                  </Form.Item>
                  <Form.Item name="role" label="角色" rules={[{ required: true }]} initialValue="student">
                    <Select placeholder="请选择角色">
                      <Option value="coach">教练</Option>
                      <Option value="student">学员</Option>
                    </Select>
                  </Form.Item>
                  <Form.Item name="coachId" label="选择教练" dependencies={['role']}>
                    <Select placeholder="请选择教练" disabled={coaches.length === 0}>
                      {coaches.map(coach => (
                        <Option key={coach.id} value={coach.id}>{coach.username}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" loading={loading} block size="large">
                      注册
                    </Button>
                  </Form.Item>
                </Form>
              )
            }
          ]}
        />
      </Card>
    </div>
  );
};

// 主应用布局
const MainApp: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeKey, setActiveKey] = useState('upload');
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  // 检查系统状态
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/health`)
      .then(res => res.json())
      .then(data => setSystemStatus(data))
      .catch(console.error);
  }, []);

  if (!user) return null;

  const menuItems = [
    { key: 'upload', icon: <UploadOutlined />, label: '上传分析' },
    { key: 'history', icon: <HistoryOutlined />, label: '历史记录' },
  ];

  // 教练特有菜单项
  if (user.role === 'coach') {
    menuItems.push(
      { key: 'students', icon: <TeamOutlined />, label: '学员管理' },
      { key: 'stats', icon: <BarChartOutlined />, label: '统计分析' }
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="dark">
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #303030' }}>
          <Title level={4} style={{ color: 'white', margin: 0 }}>🎯 射击分析</Title>
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[activeKey]} onClick={({ key }) => setActiveKey(key)} items={menuItems} />
        <div style={{ position: 'absolute', bottom: 0, width: '100%', padding: 16, borderTop: '1px solid #303030' }}>
          <div style={{ color: 'white', marginBottom: 8 }}>
            <UserOutlined /> {user.username}
            <Tag color={user.role === 'coach' ? 'blue' : 'green'} style={{ marginLeft: 8 }}>
              {user.role === 'coach' ? '教练' : '学员'}
            </Tag>
          </div>
          <Button type="text" danger icon={<LogoutOutlined />} onClick={logout} block>退出登录</Button>
        </div>
      </Sider>
      
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
          <Title level={3} style={{ margin: 0 }}>
            {activeKey === 'upload' && '📤 图片上传与AI分析'}
            {activeKey === 'history' && '📋 训练历史记录'}
            {activeKey === 'students' && '👥 学员管理'}
            {activeKey === 'stats' && '📊 统计分析'}
          </Title>
          {systemStatus && (
            <Tag color={systemStatus.mode === 'AI' ? 'green' : 'orange'}>
              {systemStatus.mode === 'AI' ? '🤖 AI模式' : '🎯 演示模式'}
            </Tag>
          )}
        </Header>
        <Content style={{ margin: 24, background: '#fff', padding: 24, minHeight: 280 }}>
          {activeKey === 'upload' && <UploadPage />}
          {activeKey === 'history' && <HistoryPage />}
          {activeKey === 'students' && user.role === 'coach' && <StudentsPage />}
          {activeKey === 'stats' && user.role === 'coach' && <StatsPage />}
        </Content>
      </Layout>
    </Layout>
  );
};

// 上传分析页面
const UploadPage: React.FC = () => {
  const { token } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const uploadProps = {
    name: 'image',
    showUploadList: false,
    beforeUpload: async (file: File) => {
      setUploading(true);
      setAnalysisResult(null);
      
      const formData = new FormData();
      formData.append('image', file);
      
      try {
        const res = await fetch(`${BACKEND_URL}/api/records`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        const data = await res.json();
        
        if (data.success) {
          message.success('上传成功！');
          setAnalysisResult(data);
        } else {
          message.error(data.error || '上传失败');
        }
      } catch (error) {
        message.error('上传失败');
      } finally {
        setUploading(false);
      }
      return false;
    }
  };

  return (
    <div>
      <Row gutter={24}>
        <Col span={12}>
          <Card title="上传靶图">
            <Upload.Dragger {...uploadProps} disabled={uploading}>
              <p className="ant-upload-drag-icon">
                <PictureOutlined style={{ fontSize: 48, color: '#1890ff' }} />
              </p>
              <p className="ant-upload-text">点击或拖拽图片到此区域上传</p>
              <p className="ant-upload-hint">支持 JPG、PNG 格式，文件大小不超过 50MB</p>
            </Upload.Dragger>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="AI分析结果">
            {analysisResult ? (
              <div>
                {analysisResult.record && (
                  <Image 
                    src={analysisResult.record.url?.startsWith('data:') ? analysisResult.record.url : `${BACKEND_URL}${analysisResult.record.url}`} 
                    style={{ width: '100%', maxHeight: 300, objectFit: 'contain' }} 
                  />
                )}
                {analysisResult.analysis && (
                  <div>
                    {analysisResult.analysis.metadata?.hit_ring && (
                      <div style={{ textAlign: 'center', marginBottom: 16 }}>
                        <Tag color="blue" style={{ fontSize: 24, padding: '8px 16px' }}>
                          🎯 {analysisResult.analysis.metadata.hit_ring} 环
                        </Tag>
                      </div>
                    )}
                    {analysisResult.analysis.improvement_suggestions && (
                      <Collapse defaultActiveKey={['0']}>
                        <Panel header="💡 改进建议" key="0">
                          {analysisResult.analysis.improvement_suggestions.map((suggestion: any, idx: number) => (
                            <div key={idx} style={{ marginBottom: 12 }}>
                              <Tag color={suggestion.priority === 'high' ? 'red' : 'orange'}>
                                {suggestion.priority === 'high' ? '高优先级' : '建议'}
                              </Tag>
                              <div><Text strong>{suggestion.title}</Text></div>
                              <div><Text type="secondary">{suggestion.practice_method}</Text></div>
                            </div>
                          ))}
                        </Panel>
                      </Collapse>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <Empty description="请先上传图片进行分析" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// 历史记录页面 - 支持筛选、搜索、导出
const HistoryPage: React.FC = () => {
  const { token } = useAuth();
  const [records, setRecords] = useState<ShotRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<ShotRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const [minRing, setMinRing] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<any[]>([]);
  const pageSize = 12;

  const fetchAllRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/records?page=1&pageSize=1000`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setRecords(data.records);
        setFilteredRecords(data.records);
      }
    } catch (error) {
      message.error('获取记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 前端筛选逻辑
  useEffect(() => {
    let filtered = [...records];
    if (searchText) {
      filtered = filtered.filter(r => 
        r.originalFilename.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    if (minRing !== null) {
      filtered = filtered.filter(r => {
        const ring = r.analysis?.metadata?.hit_ring;
        return ring !== undefined && ring >= minRing;
      });
    }
    if (dateRange && dateRange.length === 2) {
      const start = dateRange[0].startOf('day');
      const end = dateRange[1].endOf('day');
      filtered = filtered.filter(r => {
        const date = dayjs(r.uploadedAt);
        return date.isAfter(start) && date.isBefore(end);
      });
    }
    setFilteredRecords(filtered);
    setPage(1);
  }, [records, searchText, minRing, dateRange]);

  useEffect(() => { fetchAllRecords(); }, [token]);

  const handleDelete = async (record: ShotRecord) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      onOk: async () => {
        try {
          const res = await fetch(`${BACKEND_URL}/api/records/${record.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            message.success('删除成功');
            fetchAllRecords();
          }
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  // CSV导出功能
  const exportToCSV = () => {
    const headers = ['文件名', '上传时间', '环数', '评分'];
    const rows = filteredRecords.map(r => [
      r.originalFilename,
      dayjs(r.uploadedAt).format('YYYY-MM-DD HH:mm:ss'),
      r.analysis?.metadata?.hit_ring || '',
      r.analysis?.overall_assessment?.comprehensive_score || ''
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `射击训练记录_${dayjs().format('YYYYMMDD')}.csv`;
    link.click();
    message.success('导出成功！');
  };

  const paginatedRecords = filteredRecords.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>训练历史记录</Title>
          <Space>
            <Button icon={<DownloadOutlined />} onClick={exportToCSV} disabled={filteredRecords.length === 0}>导出CSV</Button>
            <Button icon={<ReloadOutlined />} onClick={fetchAllRecords} loading={loading}>刷新</Button>
          </Space>
        </div>
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space wrap>
            <Input placeholder="搜索文件名..." prefix={<SearchOutlined />} value={searchText} onChange={(e) => setSearchText(e.target.value)} style={{ width: 250 }} allowClear />
            <InputNumber placeholder="最低环数" prefix={<FilterOutlined />} value={minRing} onChange={setMinRing} min={0} max={10.9} step={0.5} />
            <DatePicker.RangePicker placeholder={['开始日期', '结束日期']} value={dateRange as any} onChange={(dates) => setDateRange(dates || [])} />
          </Space>
        </Card>
      </div>

      <Spin spinning={loading}>
        {paginatedRecords.length === 0 ? (
          <Empty description="暂无记录" />
        ) : (
          <>
            <Text type="secondary">共找到 {filteredRecords.length} 条记录</Text>
            <List
              grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4, xl: 4 }}
              dataSource={paginatedRecords}
              renderItem={(item) => (
                <List.Item>
                  <Card
                    hoverable
                    cover={<Image src={item.url?.startsWith('data:') ? item.url : `${BACKEND_URL}${item.url}`} preview={false} style={{ height: 200, objectFit: 'cover' }} onClick={() => setPreviewImage(item.url?.startsWith('data:') ? item.url : `${BACKEND_URL}${item.url}`)} />}
                    actions={[
                      <Button type="link" size="small" onClick={() => setPreviewImage(item.url?.startsWith('data:') ? item.url : `${BACKEND_URL}${item.url}`)}>查看</Button>,
                      <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(item)}>删除</Button>,
                    ]}
                  >
                    <Card.Meta
                      title={<Text ellipsis>{item.originalFilename}</Text>}
                      description={
                        <div style={{ fontSize: '12px' }}>
                          <div>📅 {dayjs(item.uploadedAt).format('YYYY-MM-DD HH:mm')}</div>
                          <div style={{ marginTop: 4 }}>
                            {item.analysis?.metadata?.hit_ring && <Tag color="blue">🎯 {item.analysis.metadata.hit_ring}环</Tag>}
                          </div>
                        </div>
                      }
                    />
                  </Card>
                </List.Item>
              )}
            />
            {filteredRecords.length > pageSize && (
              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <Pagination current={page} total={filteredRecords.length} pageSize={pageSize} onChange={setPage} />
              </div>
            )}
          </>
        )}
      </Spin>

      <Modal open={!!previewImage} footer={null} onCancel={() => setPreviewImage(null)} width="80%">
        {previewImage && <Image src={previewImage} style={{ width: '100%' }} />}
      </Modal>
    </div>
  );
};

// 学员管理页面（教练端）
const StudentsPage: React.FC = () => {
  const { token } = useAuth();
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/coach/students`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setStudents(data.students);
    } catch (error) {
      message.error('获取学员失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStudents(); }, [token]);

  return (
    <div>
      <Button icon={<ReloadOutlined />} onClick={fetchStudents} loading={loading} style={{ marginBottom: 16 }}>刷新</Button>
      <Spin spinning={loading}>
        {students.length === 0 ? (
          <Empty description="暂无学员" />
        ) : (
          <List
            grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4, xl: 4 }}
            dataSource={students}
            renderItem={(student) => (
              <List.Item>
                <Card>
                  <Card.Meta
                    avatar={<UserOutlined style={{ fontSize: 48, color: '#1890ff' }} />}
                    title={student.username}
                    description={<Tag color="green">学员</Tag>}
                  />
                </Card>
              </List.Item>
            )}
          />
        )}
      </Spin>
    </div>
  );
};

// 统计分析页面（教练端）- 数据可视化
const StatsPage: React.FC = () => {
  const { token } = useAuth();
  const [records, setRecords] = useState<ShotRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAllRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/records?page=1&pageSize=1000`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setRecords(data.records);
    } catch (error) {
      message.error('获取记录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAllRecords(); }, [token]);

  // 统计数据计算
  const totalRecords = records.length;
  const analyzedRecords = records.filter(r => r.analysis).length;
  const avgRing = records.filter(r => r.analysis?.metadata?.hit_ring).length > 0 
    ? (records.filter(r => r.analysis?.metadata?.hit_ring).reduce((sum, r) => sum + (r.analysis.metadata.hit_ring || 0), 0) / records.filter(r => r.analysis?.metadata?.hit_ring).length).toFixed(1)
    : 0;

  // 环数分布图表配置
  const getRingChartOption = () => {
    const ringData: Record<string, number> = { '10-10.9': 0, '9-9.9': 0, '8-8.9': 0, '7-7.9': 0, '6-6.9': 0, '5以下': 0 };
    records.filter(r => r.analysis?.metadata?.hit_ring).forEach(r => {
      const ring = r.analysis.metadata.hit_ring;
      if (ring >= 10) ringData['10-10.9']++;
      else if (ring >= 9) ringData['9-9.9']++;
      else if (ring >= 8) ringData['8-8.9']++;
      else if (ring >= 7) ringData['7-7.9']++;
      else if (ring >= 6) ringData['6-6.9']++;
      else ringData['5以下']++;
    });
    return {
      title: { text: '环数分布', left: 'center' },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: Object.keys(ringData) },
      yAxis: { type: 'value', name: '数量' },
      series: [{ type: 'bar', data: Object.values(ringData), itemStyle: { color: '#1890ff' } }]
    };
  };

  // 趋势图表配置
  const getTrendChartOption = () => {
    const dateData: Record<string, { count: number; totalRing: number }> = {};
    records.filter(r => r.analysis?.metadata?.hit_ring).forEach(r => {
      const date = dayjs(r.uploadedAt).format('YYYY-MM-DD');
      if (!dateData[date]) dateData[date] = { count: 0, totalRing: 0 };
      dateData[date].count++;
      dateData[date].totalRing += r.analysis.metadata.hit_ring;
    });
    const sortedDates = Object.keys(dateData).sort();
    const avgRingData = sortedDates.map(date => (dateData[date].totalRing / dateData[date].count).toFixed(1));
    return {
      title: { text: '平均环数趋势', left: 'center' },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: sortedDates },
      yAxis: { type: 'value', name: '平均环数', min: 0, max: 11 },
      series: [{ type: 'line', data: avgRingData, smooth: true, itemStyle: { color: '#52c41a' }, areaStyle: { color: 'rgba(82, 196, 26, 0.3)' } }]
    };
  };

  return (
    <div>
      <Button icon={<ReloadOutlined />} onClick={fetchAllRecords} loading={loading} style={{ marginBottom: 24 }}>刷新数据</Button>
      <Spin spinning={loading}>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card><Statistic title="总记录数" value={totalRecords} prefix={<HistoryOutlined />} /></Card>
          </Col>
          <Col span={6}>
            <Card><Statistic title="已分析" value={analyzedRecords} prefix={<RobotOutlined />} /></Card>
          </Col>
          <Col span={6}>
            <Card><Statistic title="平均环数" value={avgRing} suffix="环" prefix={<CheckCircleFilled />} /></Card>
          </Col>
        </Row>
        {records.length === 0 ? (
          <Empty description="暂无数据可分析" />
        ) : (
          <Row gutter={16}>
            <Col span={12}>
              <Card title="环数分布"><ReactECharts option={getRingChartOption()} style={{ height: 400 }} /></Card>
            </Col>
            <Col span={12}>
              <Card title="平均环数趋势"><ReactECharts option={getTrendChartOption()} style={{ height: 400 }} /></Card>
            </Col>
          </Row>
        )}
      </Spin>
    </div>
  );
};

// 主应用组件
const App: React.FC = () => {
  return (
    <AuthProvider>
      <AuthRouter />
    </AuthProvider>
  );
};

const AuthRouter: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;
  }

  return user ? <MainApp /> : <AuthPage />;
};

export default App;
