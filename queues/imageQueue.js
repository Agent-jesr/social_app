import { Queue, Worker } from 'bullmq';
import { connectionOptions } from '../config/redis.js';
import { pool } from '../config/db.js';
import { publishToAll } from '../controllers/socialController.js';

export const imageQueue = new Queue('image-publishing-queue', { connection: connectionOptions });

const imageWorker = new Worker('image-publishing-queue', async (job) => {
    // التأكد من استخراج البيانات الواردة من الكوب (Job Data) بشكل صحيح
    const { imageId, imageUrl, imageBase64, caption } = job.data || {};
    console.log(`[Worker] Starting scheduled job ID: ${job.id} for Image Database ID: ${imageId}`);

    try {
        // تجهيز كائن البيانات (Payload) ليتم تمريره ككائن متكامل لدالة publishToAll
        const payload = {
            message: caption || '',
            imageUrl: imageUrl || '',
            imageBase64: imageBase64 || ''
        };

        // استدعاء دالة النشر مع تمرير الـ payload المباشر (وبدون الحاجة لكائن res في الخلفية)
        await publishToAll(payload, null);

        await pool.query(
            `UPDATE scheduled_images SET status = $1 WHERE id = $2`,
            ['published', imageId]
        );

        console.log(`[Worker] Successfully published scheduled Image ID: ${imageId}`);
    } catch (error) {
        console.error(`[Worker Error] Failed publishing Image ID ${imageId}:`, error.message);
        throw error;
    }
}, { connection: connectionOptions });

imageWorker.on('completed', (job) => {
    console.log(`[Job Completed] Job ${job.id} finished successfully.`);
});

imageWorker.on('failed', (job, err) => {
    console.error(`[Job Failed] Job ${job.id} failed: ${err.message}`);
});