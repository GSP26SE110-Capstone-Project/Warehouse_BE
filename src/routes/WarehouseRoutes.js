import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import {
  createWarehouse,
  listWarehouses,
  getWarehouseById,
  updateWarehouse,
  deleteWarehouse,
  getWarehouseZones,
} from '../controllers/WarehouseController.js';

const router = express.Router();

// Danh sách warehouses (public cho tenant xem)
/**
 * @swagger
 * /api/warehouses:
 *   get:
 *     tags: [Warehouses]
 *     summary: Danh sách kho
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *       - in: query
 *         name: warehouseType
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Warehouse list
 */
router.get('/', listWarehouses);

// Tạo warehouse
/**
 * @swagger
 * /api/warehouses:
 *   post:
 *     tags: [Warehouses]
 *     summary: Tạo kho mới
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [warehouseId, branchId, warehouseCode, warehouseName, warehouseType, address, length, width, height]
 *             properties:
 *               warehouseId:
 *                 type: string
 *               branchId:
 *                 type: string
 *               managerId:
 *                 type: string
 *               warehouseCode:
 *                 type: string
 *               warehouseName:
 *                 type: string
 *               warehouseType:
 *                 type: string
 *                 enum: [cold_storage, normal_storage]
 *               warehouseSize:
 *                 type: string
 *                 enum: [small, medium, large, extra_large]
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               district:
 *                 type: string
 *               operatingHours:
 *                 type: string
 *               length:
 *                 type: number
 *               width:
 *                 type: number
 *               height:
 *                 type: number
 *               temperatureMin:
 *                 type: number
 *               temperatureMax:
 *                 type: number
 *     responses:
 *       201:
 *         description: Warehouse created
 */
router.post('/', requireAuth, requireRoles('admin', 'warehouse_staff'), createWarehouse);

// Lấy chi tiết warehouse
/**
 * @swagger
 * /api/warehouses/{id}:
 *   get:
 *     tags: [Warehouses]
 *     summary: Chi tiết kho
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Warehouse detail
 *       404:
 *         description: Warehouse not found
 */
router.get('/:id', getWarehouseById);

// Cập nhật warehouse
/**
 * @swagger
 * /api/warehouses/{id}:
 *   patch:
 *     tags: [Warehouses]
 *     summary: Cập nhật kho
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
 *     responses:
 *       200:
 *         description: Warehouse updated
 *       404:
 *         description: Warehouse not found
 */
router.patch('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), updateWarehouse);

// Xóa warehouse (soft delete)
/**
 * @swagger
 * /api/warehouses/{id}:
 *   delete:
 *     tags: [Warehouses]
 *     summary: Xóa mềm kho
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
 *         description: Warehouse deleted
 *       404:
 *         description: Warehouse not found
 */
router.delete('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), deleteWarehouse);

// Lấy zones trong warehouse
/**
 * @swagger
 * /api/warehouses/{id}/zones:
 *   get:
 *     tags: [Warehouses]
 *     summary: Danh sách zone thuộc kho
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Zones list
 */
router.get('/:id/zones', getWarehouseZones);

export default router;