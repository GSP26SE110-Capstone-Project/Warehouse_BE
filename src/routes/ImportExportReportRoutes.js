import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import { createImportExportReport } from '../controllers/ImportExportReportController.js';

const router = express.Router();

/**
 * @swagger
 * /api/import-export-reports:
 *   post:
 *     tags: [ImportExportReports]
 *     summary: Tạo báo cáo nhập/xuất
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Report created
 */
router.post('/', requireAuth, requireRoles('admin', 'warehouse_staff'), createImportExportReport);

export default router;
