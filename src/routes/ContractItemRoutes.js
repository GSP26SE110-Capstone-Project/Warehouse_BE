import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import {
  createContractItem,
  listContractItems,
  getContractItemById,
  updateContractItem,
  deleteContractItem,
} from '../controllers/ContractItemController.js';

const router = express.Router();

/**
 * @swagger
 * /api/contract-items:
 *   get:
 *     tags: [ContractItems]
 *     summary: Danh sách mục hợp đồng
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Contract items list
 */
router.get('/', requireAuth, requireRoles('admin', 'tenant_admin', 'warehouse_staff', 'transport_staff'), listContractItems);

/**
 * @swagger
 * /api/contract-items:
 *   post:
 *     tags: [ContractItems]
 *     summary: Tạo mục hợp đồng
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Contract item created
 */
router.post('/', requireAuth, requireRoles('admin', 'warehouse_staff'), createContractItem);

/**
 * @swagger
 * /api/contract-items/{id}:
 *   get:
 *     tags: [ContractItems]
 *     summary: Chi tiết mục hợp đồng
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
 *         description: Contract item detail
 */
router.get('/:id', requireAuth, requireRoles('admin', 'tenant_admin', 'warehouse_staff', 'transport_staff'), getContractItemById);

/**
 * @swagger
 * /api/contract-items/{id}:
 *   patch:
 *     tags: [ContractItems]
 *     summary: Cập nhật mục hợp đồng
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
 *         description: Contract item updated
 */
router.patch('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), updateContractItem);

/**
 * @swagger
 * /api/contract-items/{id}:
 *   delete:
 *     tags: [ContractItems]
 *     summary: Xóa mục hợp đồng
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
 *         description: Contract item deleted
 */
router.delete('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), deleteContractItem);

export default router;

