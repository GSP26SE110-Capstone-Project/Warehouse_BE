import express from 'express';
import {
  listWarehouses,
  getWarehouseById,
  getWarehouseZones,
} from '../controllers/WarehouseController.js';

const router = express.Router();

// Danh sách warehouses (public cho tenant xem)
router.get('/', listWarehouses);

// Lấy chi tiết warehouse
router.get('/:id', getWarehouseById);

// Lấy zones trong warehouse
router.get('/:id/zones', getWarehouseZones);

export default router;