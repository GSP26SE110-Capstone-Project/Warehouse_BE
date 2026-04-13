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
router.get('/', listWarehouses);

// Tạo warehouse
router.post('/', requireAuth, requireRoles('admin', 'warehouse_manager'), createWarehouse);

// Lấy chi tiết warehouse
router.get('/:id', getWarehouseById);

// Cập nhật warehouse
router.patch('/:id', requireAuth, requireRoles('admin', 'warehouse_manager'), updateWarehouse);

// Xóa warehouse (soft delete)
router.delete('/:id', requireAuth, requireRoles('admin', 'warehouse_manager'), deleteWarehouse);

// Lấy zones trong warehouse
router.get('/:id/zones', getWarehouseZones);

export default router;