import fs from 'fs';
import path from 'path';
import { prisma } from '../config/prisma.js';
import { imageQueue } from '../queues/imageQueue.js'; // مسار طابور المهام لديك

export async function scheduleImage(req, res) {
  try {
    const { title, message, caption, imageUrl, imageBase64, publishAt } = req.body;

    if (!publishAt) {
      return res.status(400).json({ success: false, error: 'تاريخ ووقت النشر مطلوب للجدولة.' });
    }

    let finalImageUrl = imageUrl || '';
    let storedBase64 = imageBase64 || '';

    const rawBase64 = storedBase64 || (typeof imageUrl === 'string' && imageUrl.startsWith('data:image') ? imageUrl : null);

    if (rawBase64) {
      const base64Data = rawBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      const filename = `final-${Date.now()}.png`;
      const uploadDir = path.join(process.cwd(), 'uploads');
      
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      fs.writeFileSync(path.join(uploadDir, filename), buffer);

      finalImageUrl = `uploads/${filename}`;
      if (!storedBase64) {
        storedBase64 = rawBase64;
      }
    }

    const savedRecord = await prisma.scheduledImage.create({
      data: {
        title: title || 'منشور جديد',
        prompt: caption || message || '',
        imageUrl: finalImageUrl,
        imageBase64: storedBase64,
        scheduledAt: new Date(publishAt),
        publishAt: new Date(publishAt),
        status: 'pending'
      }
    });

    console.log('✅ تم حفظ بيانات الجدولة عبر ORM بمعرف:', savedRecord.id);

    const publishTime = new Date(publishAt).getTime();
    const delay = publishTime - Date.now();

    if (delay > 0) {
      await imageQueue.add(
        'publish-scheduled-post',
        {
          imageId: savedRecord.id,
          imageUrl: savedRecord.imageUrl,
          imageBase64: savedRecord.imageBase64,
          caption: savedRecord.prompt
        },
        { delay }
      );
    }

    return res.status(200).json({
      success: true,
      message: 'تمت جدولة المنشور بنجاح!',
      data: savedRecord
    });

  } catch (error) {
    console.error('❌ خطأ في الجدولة عبر ORM:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}