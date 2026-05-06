import fetch from 'node-fetch';

const API_KEY = 'ark-8c56b85b-24c2-470d-b51f-90b730549164-9d11b';
const MODEL_NAME = 'ep-20260421181425-qstst';

async function testAPI() {
  console.log('🚀 开始测试豆包API...');
  console.log('🔑 API Key:', API_KEY.substring(0, 20) + '...');
  console.log('🤖 模型:', MODEL_NAME);
  console.log('');

  try {
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAAXNSR0IArs4c6QAAAAh0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5pva2AAAAAASUVORK5CYII=';

    console.log('📡 发送API请求...');
    
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          {
            role: 'system',
            content: '你是一个测试助手'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: '你好，请回复：测试成功！' }
            ]
          }
        ],
        max_tokens: 512
      })
    });

    console.log('📬 收到响应，状态码:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ API调用失败！');
      console.log('错误详情:', errorText);
      return false;
    }

    const data = await response.json();
    console.log('✅ API调用成功！');
    console.log('📄 响应数据:', JSON.stringify(data, null, 2));
    
    if (data.choices && data.choices[0]) {
      console.log('💬 模型回复:', data.choices[0].message.content);
    }
    
    return true;

  } catch (error) {
    console.log('❌ 发生异常！');
    console.log('错误详情:', error);
    return false;
  }
}

testAPI().then(success => {
  console.log('');
  if (success) {
    console.log('🎉 测试完成！API工作正常！');
  } else {
    console.log('⚠️ 测试失败，请检查配置！');
  }
});
