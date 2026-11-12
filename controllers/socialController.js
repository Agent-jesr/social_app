import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export async function postToTelegram(message, imageInfo, targetChatId = null) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = targetChatId || process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    throw new Error('بيانات TELEGRAM_BOT_TOKEN أو TELEGRAM_CHAT_ID غير مجهزة');
  }

  // إذا لم تقم الصورة بمعالجة مسبقة كـ buffer أو رابط
  if (!imageInfo || (!imageInfo.buffer && !imageInfo.url && !imageInfo.imageBase64)) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });
    return response.data;
  }

  const url = `https://api.telegram.org/bot${token}/sendPhoto`;
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', message);
  form.append('parse_mode', 'HTML');

  // استخدام imageBase64 أو buffer الممرر مباشرة إن وجد
  if (imageInfo.imageBase64 && typeof imageInfo.imageBase64 === 'string' && imageInfo.imageBase64.startsWith('data:image')) {
    const base64Data = imageInfo.imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    form.append('photo', buffer, {
      filename: 'image.png',
      contentType: 'image/png',
    });
  } else if (imageInfo.buffer) {
    form.append('photo', imageInfo.buffer, {
      filename: imageInfo.filename || 'image.png',
      contentType: imageInfo.contentType || 'image/png'
    });
  } else {
    form.append('photo', imageInfo.url);
  }

  const response = await axios.post(url, form, {
    headers: { ...form.getHeaders() }
  });

  return response.data;
}


// export async function postToFacebook(message, imageInfo) {
//   console.info("facebook");

//   const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;
//   if (!MAKE_WEBHOOK_URL) {
//     throw new Error('رابط MAKE_WEBHOOK_URL غير مجهز');
//   }

//   const imagePath = imageInfo.imageUrl;
  
//   const payload = {
//     message: message,
//     imageUrl: imagePath
//   };

//   console.log("Final Public Facebook image URL:", payload.imageUrl);

//   const response = await axios.post(MAKE_WEBHOOK_URL, payload);
//   return response.data;
// }

export async function postToFacebook(message, imageInfo) {
  const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;
  if (!MAKE_WEBHOOK_URL) throw new Error('رابط MAKE_WEBHOOK_URL غير مجهز');

  let imagePath = imageInfo?.imageUrl || imageInfo?.url;
  const baseUrl = (process.env.PUBLIC_URL || 'https://balsamic-renewable-discern.ngrok-free.dev').replace(/\/$/, '');

  // استخراج اسم الملف الفعلي إذا كان موجوداً، وإلا استخدام الـ image.png كخيار أخير
  let finalImageUrl = imagePath?.startsWith('https://') 
    ? imagePath 
    : `${baseUrl}/uploads/${imageInfo?.filename || (imagePath ? path.basename(imagePath) : 'image.png')}`;

  console.log("Final Public Facebook image URL:", finalImageUrl);  

  const response = await axios.post(MAKE_WEBHOOK_URL, { message, imageUrl: finalImageUrl });
  return response.data;
}



export async function postToInstagram(message, imageInfo) {
  const igUserId = process.env.INSTAGRAM_ACCOUNT_ID;
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!igUserId || !token) {
    throw new Error('بيانات INSTAGRAM_ACCOUNT_ID أو FACEBOOK_PAGE_ACCESS_TOKEN غير مجهزة');
  }

  const targetUrl = imageInfo ? (imageInfo.url || imageInfo.imageUrl) : null;
  if (!targetUrl) {
    throw new Error('النشر على إنستغرام يتطلب رابط صورة صالح');
  }

  const containerUrl = `https://graph.facebook.com/v19.0/${igUserId}/media`;
  const containerResponse = await axios.post(containerUrl, {
    image_url: targetUrl,
    caption: message,
    access_token: token
  });

  const creationId = containerResponse.data.id;
  const publishUrl = `https://graph.facebook.com/v19.0/${igUserId}/media_publish`;
  
  const publishResponse = await axios.post(publishUrl, {
    creation_id: creationId,
    access_token: token
  });

  return publishResponse.data;
}


export async function publishToAll(req, res) {
  const payload = req?.body || req;
  const { message, imageUrl, imageBase64, telegramChatId } = payload || {};

  if (!message) {
    const errorMsg = 'محتوى الرسالة (message) مطلوب';
    if (res && typeof res.status === 'function') {
      return res.status(400).json({ error: errorMsg });
    }
    throw new Error(errorMsg);
  }

  const imageInfo = {
    imageUrl: imageUrl,
    imageBase64: imageBase64,
    url: typeof imageUrl === 'string' && !imageUrl.startsWith('data:image') ? imageUrl : null
  };

  const tasks = [
    postToTelegram(message, imageInfo, telegramChatId),
    postToFacebook(message, imageInfo)
  ];

  if (imageInfo && (imageInfo.url || imageInfo.imageBase64)) {
    tasks.push(postToInstagram(message, imageInfo));
  }

  const [telegramResult, facebookResult, instagramResult] = await Promise.allSettled(tasks);

  const results = {
    telegram: telegramResult.status === 'fulfilled' 
      ? telegramResult.value 
      : { error: telegramResult.reason?.response?.data || telegramResult.reason?.message },
    facebook: facebookResult.status === 'fulfilled' 
      ? facebookResult.value 
      : { error: facebookResult.reason?.response?.data || facebookResult.reason?.message },
    instagram: instagramResult ? (
      instagramResult.status === 'fulfilled' 
        ? instagramResult.value 
        : { error: instagramResult.reason?.response?.data || instagramResult.reason?.message }
    ) : { skipped: 'تم تخطي إنستغرام لعدم وجود رابط صورة' }
  };

  if (!res || typeof res.json !== 'function') {
    return { status: 'completed', results };
  }

  return res.json({
    status: 'completed',
    results
  });
}