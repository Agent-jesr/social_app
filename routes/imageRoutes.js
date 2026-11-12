import { Router } from 'express';
import { generateAndBrandingImage ,getStoredImages} from '../controllers/imageController.js';
import { scheduleImage } from '../controllers/scheduleController.js';

const router = Router();

router.post('/generate', generateAndBrandingImage);
router.post('/schedule-image',scheduleImage);

router.get('/images',getStoredImages);

export default router;