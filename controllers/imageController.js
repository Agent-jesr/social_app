import path from 'path';
import axios from 'axios';
import fs from 'fs';
import sharp from 'sharp';
import { prisma } from '../config/prisma.js';

const getImageSize = (ratio) => {
  switch (ratio) {
    case '16:9': return { width: 1792, height: 1024 };
    case '9:16': return { width: 1024, height: 1792 };
    case '1:1':
    default: return { width: 1024, height: 1024 };
  }
};


function processImageData(imageBuffer) {
  if (!imageBuffer) return null;

  const filename = `final-${Date.now()}.png`;
  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  const filepath = path.join(uploadDir, filename);
  fs.writeFileSync(filepath, imageBuffer);

  const base64Data = imageBuffer.toString('base64');
  const imageBase64 = `data:image/png;base64,${base64Data}`;

  return {
    isBase64: true,
    buffer: imageBuffer,
    filename,
    contentType: 'image/png',
    imageBase64: imageBase64
  };
}

export const generateAndBrandingImage = async (req, res) => {
  const { prompt, aspectRatio } = req.body;

  console.log('🚀 تم استقبال طلب جديد لتوليد وتعديل الصورة:', { prompt, aspectRatio });

  if (!prompt) {
    return res.status(400).json({ success: false, error: 'وصف الصورة مطلوب.' });
  }

  const { width, height } = getImageSize(aspectRatio);
  const sizeString = `${width}x${height}`;

  try {
    console.log('🎨 جاري توليد الصورة من OpenAI...');
    const adjustedPrompt = `${prompt}. Professional advertisement style, leave a clean, solid, well-lit empty space specifically in the top-right corner without any distracting elements, perfectly suited for placing a corporate logo later.`;
    
    const genResponse = await axios.post(
      'https://api.openai.com/v1/images/generations',
      {
        model: 'gpt-image-2.5-flare', 
        prompt: adjustedPrompt,
        n: 1,
        size: sizeString,
        quality: 'high'
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const responseData = genResponse.data.data?.[0];
    let imageBuffer;

    if (responseData?.url) {
      console.log('📥 جاري تحميل الصورة من الرابط العائد...');
      const imageRes = await axios.get(responseData.url, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(imageRes.data);
    } else if (responseData?.b64_json) {
      imageBuffer = Buffer.from(responseData.b64_json, 'base64');
    } else {
      return res.status(500).json({ success: false, error: 'فشل استخراج الصورة من OpenAI.' });
    }

    const logoPath = path.join(process.cwd(), 'uploads', 'logo.png');

    if (fs.existsSync(logoPath)) {
      try {
        console.log('🪄 جاري دمج الشعار في الزاوية العلوية اليمنى باستخدام Sharp...');

        const logoWidth = Math.round(width * 0.15);
        const logoBuffer = await sharp(logoPath)
          .resize({ width: logoWidth })
          .toBuffer();

        const margin = Math.round(width * 0.04);

        imageBuffer = await sharp(imageBuffer)
          .composite([
            {
              input: logoBuffer,
              gravity: 'northeast',
              left: width - logoWidth - margin,
              top: margin
            }
          ])
          .png()
          .toBuffer();

        console.log('✅ تم دمج الشعار في المكان المخصص بنجاح.');
      } catch (sharpErr) {
        console.warn('⚠️ خطأ أثناء دمج الشعار بـ Sharp:', sharpErr.message);
      }
    } else {
      console.warn('⚠️ ملف الشعار غير موجود محلياً في المسار:', logoPath);
    }

    const processedImage = processImageData(imageBuffer);

    const finalImageUrl = `${process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`}/uploads/${processedImage.filename}`;

    console.log("image controller : image url ",finalImageUrl);
    
    return res.status(200).json({
      success: true,
      prompt: prompt,
      imageUrl: finalImageUrl,
      imageBase64: processedImage.imageBase64, 
      caption: `✨ تصميم احترافي مع الشعار: ${prompt}`
    });

  } catch (error) {
    console.error('❌ خطأ تفصيلي:', error.response?.data || error.message);
    return res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message || 'فشل توليد أو تعديل الصورة.' 
    });
  }
};



export async function getStoredImages(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const skip = (page - 1) * limit;

    const totalItems = await prisma.scheduledImage.count();
    const totalPages = Math.ceil(totalItems / limit);

    const imagesRecords = await prisma.scheduledImage.findMany({
      orderBy: { id: 'desc' },
      skip: skip,
      take: limit,
    });

    const images = imagesRecords.map(row => {
      let fullUrl = row.imageUrl;
      if (fullUrl && !fullUrl.startsWith('http') && !fullUrl.startsWith('data:image')) {
        const baseUrl = (process.env.PUBLIC_URL || 'http://192.168.1.176:5000').replace(/\/$/, '');
        const cleanPath = fullUrl.trim().replace(/^\/+/, '');
        fullUrl = `${baseUrl}/${cleanPath.replace(/^uploads\//, 'uploads/')}`;
      }

      return {
        id: row.id,
        title: row.title || 'منشور بدون عنوان',
        prompt: row.prompt || '',
        url: fullUrl,
        imageBase64: row.imageBase64,
        scheduledAt: row.scheduledAt,
        publishAt: row.publishAt,
        status: row.status
      };
    });

    return res.json({ 
      success: true, 
      images, 
      currentPage: page,
      totalPages: totalPages,
      totalItems: totalItems
    });

  } catch (err) {
    console.error('❌ خطأ في جلب الصور عبر ORM:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}