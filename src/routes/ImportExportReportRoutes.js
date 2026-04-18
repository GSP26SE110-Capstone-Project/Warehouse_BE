import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import { createImportExportReport } from '../controllers/ImportExportReportController.js';

const router = express.Router();

/**
 * @swagger
 * /api/import-export-reports:
 *   post:
 *     tags: [ImportExportReports]
 *     summary: Tạo báo cáo nhập/xuất (JSON tổng hợp theo kỳ, không lưu bản ghi báo cáo vào DB)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - from
 *               - to
 *             properties:
 *               from:
 *                 type: string
 *                 format: date-time
 *                 description: Mốc đầu kỳ (ISO datetime hoặc chuỗi Date.parse được)
 *               to:
 *                 type: string
 *                 format: date-time
 *                 description: Mốc cuối kỳ
 *               basis:
 *                 type: string
 *                 enum: [scheduled, actual]
 *                 default: scheduled
 *                 description: scheduled = lọc theo scheduled_datetime; actual = theo actual_datetime (bỏ qua bản ghi chưa có actual)
 *               warehouseId:
 *                 type: string
 *                 nullable: true
 *               contractId:
 *                 type: string
 *                 nullable: true
 *               tenantId:
 *                 type: string
 *                 nullable: true
 *               recordType:
 *                 type: string
 *                 enum: [IMPORT, EXPORT]
 *                 nullable: true
 *               status:
 *                 type: string
 *                 nullable: true
 *               includeDetails:
 *                 type: boolean
 *                 default: true
 *               detailsLimit:
 *                 type: integer
 *                 default: 200
 *                 minimum: 1
 *                 maximum: 2000
 *                 description: Số dòng chi tiết tối đa trong response
 *           example:
 *             from: "2026-01-01T00:00:00.000Z"
 *             to: "2026-06-30T23:59:59.999Z"
 *             basis: scheduled
 *             warehouseId: WH0001
 *             includeDetails: true
 *             detailsLimit: 200
 *     responses:
 *       201:
 *         description: Báo cáo JSON (reportId UUID, summary, details…)
 *       400:
 *         description: Thiếu from/to, basis sai, hoặc from > to
 */
router.post('/', requireAuth, requireRoles('admin', 'warehouse_staff'), createImportExportReport);

export default router;
