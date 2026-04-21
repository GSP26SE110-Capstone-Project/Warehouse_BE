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
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: vacant
 *         schema:
 *           type: boolean
 *         description: >
 *           true = chỉ các kho đang không có hợp đồng ACTIVE nào (thuê cả kho, zone hoặc slot trong kho).
 *           Dùng để liệt kê kho còn trống cho tenant mới.
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
 *             required: [warehouseCode, warehouseName, address, length, width, height]
 *             properties:
 *               branchId:
 *                 type: string
 *                 description: Tùy chọn. Nếu không gửi, hệ thống tự suy ra từ managerId hoặc user đăng nhập
 *               managerId:
 *                 type: string
 *               warehouseCode:
 *                 type: string
 *               warehouseName:
 *                 type: string
 *               address:
 *                 type: string
 *               district:
 *                 type: string
 *               operatingHours:
 *                 type: string
 *               length:
 *                 type: number
 *                 minimum: 0.000001
 *                 description: Chiều dài kho, phải > 0
 *               width:
 *                 type: number
 *                 minimum: 0.000001
 *                 description: Chiều rộng kho, phải > 0
 *               height:
 *                 type: number
 *                 minimum: 0.000001
 *                 description: Chiều cao kho, phải > 0
 *               totalArea:
 *                 type: number
 *                 minimum: 0.000001
 *                 description: Nếu truyền thì phải bằng length * width
 *               usableArea:
 *                 type: number
 *                 minimum: 0
 *                 description: Nếu truyền thì phải >= 0 và không vượt totalArea
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
 *       required: false
 *       description: Ít nhất một field. Không gửi warehouseId (khóa chính). length/width/height phải > 0; totalArea (nếu gửi) phải bằng length * width; usableArea phải >= 0 và không vượt totalArea.
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               branchId:
 *                 type: string
 *               managerId:
 *                 type: string
 *               warehouseCode:
 *                 type: string
 *               warehouseName:
 *                 type: string
 *               address:
 *                 type: string
 *               district:
 *                 type: string
 *               operatingHours:
 *                 type: string
 *               length:
 *                 type: number
 *                 minimum: 0.000001
 *               width:
 *                 type: number
 *                 minimum: 0.000001
 *               height:
 *                 type: number
 *                 minimum: 0.000001
 *               totalArea:
 *                 type: number
 *                 minimum: 0.000001
 *               usableArea:
 *                 type: number
 *                 minimum: 0
 *               isActive:
 *                 type: boolean
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