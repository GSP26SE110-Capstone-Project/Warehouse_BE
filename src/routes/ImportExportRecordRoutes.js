import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import {
  createImportExportRecord,
  listImportExportRecords,
  getImportExportRecordById,
  updateImportExportRecord,
  deleteImportExportRecord,
} from '../controllers/ImportExportRecordController.js';

const router = express.Router();

/**
 * @swagger
 * /api/import-export-records:
 *   get:
 *     tags: [ImportExportRecords]
 *     summary: Danh sách phiếu nhập/xuất
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Records list
 */
router.get('/', requireAuth, requireRoles('admin', 'warehouse_staff'), listImportExportRecords);

/**
 * @swagger
 * /api/import-export-records:
 *   post:
 *     tags: [ImportExportRecords]
 *     summary: Tạo phiếu nhập/xuất
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Record created
 */
router.post('/', requireAuth, requireRoles('admin', 'warehouse_staff'), createImportExportRecord);

/**
 * @swagger
 * /api/import-export-records/{id}:
 *   get:
 *     tags: [ImportExportRecords]
 *     summary: Chi tiết phiếu nhập/xuất
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Record detail
 */
router.get('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), getImportExportRecordById);

/**
 * @swagger
 * /api/import-export-records/{id}:
 *   patch:
 *     tags: [ImportExportRecords]
 *     summary: Cập nhật phiếu nhập/xuất
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Record updated
 */
router.patch('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), updateImportExportRecord);

/**
 * @swagger
 * /api/import-export-records/{id}:
 *   delete:
 *     tags: [ImportExportRecords]
 *     summary: Hủy phiếu nhập/xuất
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Record cancelled
 */
router.delete('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), deleteImportExportRecord);

export default router;

