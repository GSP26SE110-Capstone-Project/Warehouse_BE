import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import {
  createContract,
  listContracts,
  getContractById,
  updateContract,
  deleteContract,
  sendContractToTenant,
  signContractByTenant,
} from '../controllers/ContractController.js';

const router = express.Router();

// Danh sách contracts
/**
 * @swagger
 * /api/contracts:
 *   get:
 *     tags: [Contracts]
 *     summary: Danh sách hợp đồng
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Contracts list
 */
router.get('/', requireAuth, requireRoles('admin', 'tenant_admin', 'warehouse_staff', 'transport_staff'), listContracts);

// Tạo contract mới
/**
 * @swagger
 * /api/contracts:
 *   post:
 *     tags: [Contracts]
 *     summary: Tạo hợp đồng mới
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Contract created
 */
router.post('/', requireAuth, requireRoles('admin', 'warehouse_staff'), createContract);

// Chi tiết contract
/**
 * @swagger
 * /api/contracts/{id}:
 *   get:
 *     tags: [Contracts]
 *     summary: Chi tiết hợp đồng
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
 *         description: Contract detail
 */
router.get('/:id', requireAuth, requireRoles('admin', 'tenant_admin', 'warehouse_staff', 'transport_staff'), getContractById);

// Cập nhật contract
/**
 * @swagger
 * /api/contracts/{id}:
 *   patch:
 *     tags: [Contracts]
 *     summary: Cập nhật hợp đồng
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
 *         description: Contract updated
 */
router.patch('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), updateContract);

// Gui hop dong cho tenant
/**
 * @swagger
 * /api/contracts/{id}/send:
 *   post:
 *     tags: [Contracts]
 *     summary: Gửi hợp đồng cho tenant
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
 *         description: Contract sent
 */
router.post('/:id/send', requireAuth, requireRoles('admin', 'warehouse_staff'), sendContractToTenant);

// Tenant ky hop dong
/**
 * @swagger
 * /api/contracts/{id}/sign:
 *   post:
 *     tags: [Contracts]
 *     summary: Tenant ký hợp đồng
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
 *         description: Contract signed
 */
router.post('/:id/sign', requireAuth, requireRoles('tenant_admin'), signContractByTenant);

// Hủy contract (soft delete)
/**
 * @swagger
 * /api/contracts/{id}:
 *   delete:
 *     tags: [Contracts]
 *     summary: Hủy hợp đồng (soft delete)
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
 *         description: Contract cancelled
 */
router.delete('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), deleteContract);

export default router;

