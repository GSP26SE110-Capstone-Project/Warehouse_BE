import express from 'express';
import { requireAuth, requireRoles } from '../middlewares/AuthMiddleware.js';
import { createImportExportReport } from '../controllers/ImportExportReportController.js';

const router = express.Router();

router.post('/', requireAuth, requireRoles('admin', 'warehouse_staff'), createImportExportReport);

export default router;
