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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contractId
 *               - warehouseId
 *               - recordType
 *               - recordCode
 *               - scheduledDatetime
 *             properties:
 *               contractId:
 *                 type: string
 *               warehouseId:
 *                 type: string
 *               scopeType:
 *                 type: string
 *                 enum: [WAREHOUSE, ZONE, SLOT]
 *                 default: ZONE
 *                 description: ZONE bắt buộc zoneId; SLOT bắt buộc slotId; WAREHOUSE không cần zone/slot
 *               zoneId:
 *                 type: string
 *                 nullable: true
 *               slotId:
 *                 type: string
 *                 nullable: true
 *               recordType:
 *                 type: string
 *                 enum: [IMPORT, EXPORT]
 *               recordCode:
 *                 type: string
 *                 description: Mã phiếu (unique)
 *               scheduledDatetime:
 *                 type: string
 *                 format: date-time
 *               actualDatetime:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               quantity:
 *                 type: number
 *                 nullable: true
 *               weight:
 *                 type: number
 *                 nullable: true
 *               isFullZone:
 *                 type: boolean
 *                 default: false
 *               responsibleStaffId:
 *                 type: string
 *                 nullable: true
 *               vehiclePlateNumber:
 *                 type: string
 *                 nullable: true
 *               driverName:
 *                 type: string
 *                 nullable: true
 *               driverCitizenId:
 *                 type: string
 *                 nullable: true
 *               approvedBy:
 *                 type: string
 *                 nullable: true
 *               approvedAt:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               status:
 *                 type: string
 *                 enum: [PENDING, APPROVED, COMPLETED, CANCELLED]
 *                 default: PENDING
 *               cancelReason:
 *                 type: string
 *                 nullable: true
 *               notes:
 *                 type: string
 *                 nullable: true
 *           example:
 *             contractId: CTR0001
 *             warehouseId: WH0001
 *             scopeType: ZONE
 *             zoneId: ZN0001
 *             recordType: IMPORT
 *             recordCode: IER-2026-0001
 *             scheduledDatetime: "2026-06-10T08:00:00.000Z"
 *             quantity: 120
 *             weight: 1500
 *             isFullZone: false
 *             status: PENDING
 *             notes: Nhap dot 1
 *     responses:
 *       201:
 *         description: Record created (recordId do server sinh IER…)
 *       400:
 *         description: Thiếu field hoặc scopeType/zoneId/slotId không hợp lệ
 *       409:
 *         description: recordCode trùng
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
 *     description: |
 *       Cập nhật một hoặc nhiều field của phiếu nhập/xuất. Gửi body chứa **ít nhất 1** field
 *       trong danh sách bên dưới; các field không gửi sẽ giữ nguyên giá trị cũ.
 *
 *       Các field không được phép: `recordId`, `createdAt`, `updatedAt` (server bỏ qua nếu client cố gửi).
 *
 *       Nếu đổi `scopeType` thì phải kèm `zoneId`/`slotId` tương ứng (ZONE→zoneId, SLOT→slotId,
 *       WAREHOUSE không cần). Nếu đổi `recordCode` thì phải unique.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Gửi ít nhất 1 field trong các field dưới đây
 *             properties:
 *               contractId:
 *                 type: string
 *               warehouseId:
 *                 type: string
 *               scopeType:
 *                 type: string
 *                 enum: [WAREHOUSE, ZONE, SLOT]
 *               zoneId:
 *                 type: string
 *                 nullable: true
 *               slotId:
 *                 type: string
 *                 nullable: true
 *               recordType:
 *                 type: string
 *                 enum: [IMPORT, EXPORT]
 *               recordCode:
 *                 type: string
 *                 description: Mã phiếu (unique)
 *               scheduledDatetime:
 *                 type: string
 *                 format: date-time
 *               actualDatetime:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               quantity:
 *                 type: number
 *                 nullable: true
 *               weight:
 *                 type: number
 *                 nullable: true
 *               isFullZone:
 *                 type: boolean
 *               responsibleStaffId:
 *                 type: string
 *                 nullable: true
 *               vehiclePlateNumber:
 *                 type: string
 *                 nullable: true
 *               driverName:
 *                 type: string
 *                 nullable: true
 *               driverCitizenId:
 *                 type: string
 *                 nullable: true
 *               approvedBy:
 *                 type: string
 *                 nullable: true
 *               approvedAt:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               status:
 *                 type: string
 *                 enum: [PENDING, APPROVED, COMPLETED, CANCELLED]
 *               cancelReason:
 *                 type: string
 *                 nullable: true
 *               notes:
 *                 type: string
 *                 nullable: true
 *           example:
 *             status: APPROVED
 *             actualDatetime: "2026-06-10T09:15:00.000Z"
 *             quantity: 118
 *             weight: 1480
 *             approvedBy: USR0001
 *             approvedAt: "2026-06-10T09:10:00.000Z"
 *             notes: Đã nhập đủ, thiếu 2 thùng so với phiếu
 *     responses:
 *       200:
 *         description: Record updated
 *       400:
 *         description: Body rỗng (không có field hợp lệ) hoặc scopeType/zoneId/slotId không khớp
 *       404:
 *         description: Record không tồn tại
 *       409:
 *         description: recordCode trùng với phiếu khác
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

