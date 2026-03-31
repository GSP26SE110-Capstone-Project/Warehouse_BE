import express from 'express';
import {
  createRentalRequest,
  getRentalRequestById,
  listRentalRequests,
  updateRentalRequest,
  approveRentalRequest,
  rejectRentalRequest,
  getAvailableZones,
} from '../controllers/RentalRequestController.js';

const router = express.Router();

// Tạo rental request mới
router.post('/', createRentalRequest);

// Danh sách rental requests
router.get('/', listRentalRequests);

// Lấy chi tiết rental request
router.get('/:id', getRentalRequestById);

// Cập nhật rental request
router.patch('/:id', updateRentalRequest);

// Approve rental request
router.post('/:id/approve', approveRentalRequest);

// Reject rental request
router.post('/:id/reject', rejectRentalRequest);

// Lấy zones available trong warehouse
router.get('/available-zones/:warehouseId', getAvailableZones);

export default router;