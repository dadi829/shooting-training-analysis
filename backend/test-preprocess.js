import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotsDir = path.join(__dirname, 'screenshots');

async function findTargetRegion(imagePath) {
  try {
    const { data, info } = await sharp(imagePath)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const { width, height } = info;
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let foundCount = 0;
    
    const isLightYellow = (r, g, b) => r > 200 && g > 200 && b > 180;
    const stepX = Math.max(1, Math.floor(width / 200));
    const stepY = Math.max(1, Math.floor(height / 200));
    
    for (let y = 0; y < height; y += stepY) {
      for (let x = 0; x < width; x += stepX) {
        const idx = (y * width + x) * 3;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        if (isLightYellow(r, g, b)) {
          foundCount++;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    if (foundCount > 50) {
      const margin = 20;
      minX = Math.max(0, minX - margin);
      maxX = Math.min(width, maxX + margin);
      minY = Math.max(0, minY - margin);
      maxY = Math.min(height, maxY + margin);
      
      return {
        left: minX,
        top: minY,
        width: maxX - minX,
        height: maxY - minY,
        method: 'color-detection'
      };
    }
    
    return {
      left: 0,
      top: 0,
      width: Math.floor(width * 0.48),
      height: height,
      method: 'fallback-left-crop'
    };
  } catch (error) {
    console.error('findTargetRegion error:', error);
    return { left: 0, top: 0, width: 100, height: 100, method: 'fallback-default' };
  }
}

async function preprocessImage(imagePath, options = {}) {
  const { cropTarget = false, quality = 85 } = options;
  try {
    const processedPath = imagePath.replace(/\.(png|jpg|jpeg|webp)$/i, '_processed.jpg');
    let pipeline = sharp(imagePath);
    
    if (cropTarget) {
      const region = await findTargetRegion(imagePath);
      console.log(`Crop method: ${region.method}, region:`, region);
      pipeline = pipeline.extract(region);
      
      const metadata = await pipeline.metadata();
      const maxWidth = 1200;
      const maxHeight = 1600;
      let resizeWidth = metadata.width;
      let resizeHeight = metadata.height;
      
      if (metadata.width > maxWidth) {
        resizeWidth = maxWidth;
        resizeHeight = Math.floor((maxWidth / metadata.width) * metadata.height);
      }
      if (resizeHeight > maxHeight) {
        resizeHeight = maxHeight;
        resizeWidth = Math.floor((maxHeight / metadata.height) * metadata.width);
      }
      
      pipeline = pipeline.resize(resizeWidth, resizeHeight, { fit: 'inside', withoutEnlargement: true });
      pipeline = pipeline
        .modulate({ saturation: 1.05 })
        .sharpen({ sigma: 0.8, flat: 0.5, jagged: 0.3 });
    }
    
    await pipeline.jpeg({ quality, progressive: true }).toFile(processedPath);
    return processedPath;
  } catch (error) { 
    console.error('preprocess error:', error); 
    return imagePath; 
  }
}

async function testPreprocessing() {
  console.log('=== 开始测试预处理功能 ===\n');
  
  try {
    const files = fs.readdirSync(screenshotsDir)
      .filter(f => !f.includes('_processed'))
      .filter(f => /\.(jpg|jpeg|png)$/i.test(f));
    
    if (files.length === 0) {
      console.log('未找到测试图片');
      return;
    }
    
    console.log('找到 ' + files.length + ' 张测试图片\n');
    
    const testFiles = files.slice(0, 5);
    
    for (const file of testFiles) {
      const imagePath = path.join(screenshotsDir, file);
      console.log('测试图片: ' + file);
      
      console.log('  - 检测目标区域...');
      const region = await findTargetRegion(imagePath);
      console.log('    结果:', region);
      
      console.log('  - 执行预处理...');
      const processedPath = await preprocessImage(imagePath, { cropTarget: true });
      console.log('    处理完成:', processedPath);
      
      const origStat = fs.statSync(imagePath);
      const procStat = fs.statSync(processedPath);
      console.log('    原始大小:', (origStat.size / 1024).toFixed(2), 'KB');
      console.log('    处理后大小:', (procStat.size / 1024).toFixed(2), 'KB');
      
      const origMeta = await sharp(imagePath).metadata();
      const procMeta = await sharp(processedPath).metadata();
      console.log('    原始尺寸:', origMeta.width, 'x', origMeta.height);
      console.log('    处理后尺寸:', procMeta.width, 'x', procMeta.height);
      
      console.log('');
    }
    
    console.log('=== 测试完成 ===');
    console.log('\n评估指标:');
    console.log('  1. 裁剪方法: color-detection 表示成功识别浅黄色靶纸区域');
    console.log('  2. 尺寸: 应<=1200x1600');
    console.log('  3. 文件大小: 相比原图应有明显减小');
    console.log('  4. 视觉: 处理后的图片应只包含靶纸区域，无右侧表格');
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

testPreprocessing();
