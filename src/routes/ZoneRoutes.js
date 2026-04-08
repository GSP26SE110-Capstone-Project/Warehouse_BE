import express from 'express';
import { listZones } from '../controllers/ZoneController.js';

const router = express.Router();

// Danh sách zones, hỗ trợ filter query: available, warehouseId
router.get('/', listZones);

export default router;

