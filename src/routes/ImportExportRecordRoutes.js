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

router.get('/', requireAuth, requireRoles('admin', 'warehouse_staff'), listImportExportRecords);
router.post('/', requireAuth, requireRoles('admin', 'warehouse_staff'), createImportExportRecord);
router.get('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), getImportExportRecordById);
router.patch('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), updateImportExportRecord);
router.delete('/:id', requireAuth, requireRoles('admin', 'warehouse_staff'), deleteImportExportRecord);

export default router;

