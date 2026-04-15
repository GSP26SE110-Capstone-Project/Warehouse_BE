import express from 'express';
import { requireAuth } from '../middlewares/AuthMiddleware.js';
import { listMyNotifications, markNotificationRead } from '../controllers/NotificationController.js';

const router = express.Router();

router.use(requireAuth);

router.get('/me', listMyNotifications);
router.patch('/:id/read', markNotificationRead);

export default router;

