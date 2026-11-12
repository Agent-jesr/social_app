import { Router } from 'express';
import { publishToAll } from '../controllers/socialController.js';

const router = Router();

router.post('/publish-all', publishToAll);

export default router;