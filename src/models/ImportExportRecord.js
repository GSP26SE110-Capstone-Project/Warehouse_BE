/**
 * ImportExportRecord Schema - Phiếu nhập/xuất kho
 * Theo dõi nghiệp vụ nhập/xuất ở mức vận hành kho (kế hoạch vs thực tế),
 * tách biệt với Shipment (logistics vận chuyển).
 */
export const importExportRecordSchema = {
  recordId: {
    type: 'string',
    primaryKey: true,
  },
  contractId: {
    type: 'string',
    required: true,
    foreignKey: 'contract_id',
    note: 'ref Contract.contract_id - Hợp đồng liên quan',
  },
  warehouseId: {
    type: 'string',
    required: true,
    foreignKey: 'warehouse_id',
    note: 'ref Warehouse.warehouse_id - Hỗ trợ filter/report theo kho',
  },
  scopeType: {
    type: 'enum',
    enum: ['WAREHOUSE', 'ZONE', 'SLOT'],
    required: true,
    default: 'ZONE',
    note: 'Phạm vi nhập/xuất: toàn kho / khu / ô',
  },
  zoneId: {
    type: 'string',
    required: false,
    foreignKey: 'zone_id',
    note: 'ref Zone.zone_id - Bắt buộc khi scopeType = ZONE',
  },
  slotId: {
    type: 'string',
    required: false,
    foreignKey: 'slot_id',
    note: 'ref Slot.slot_id - Bắt buộc khi scopeType = SLOT',
  },
  recordType: {
    type: 'enum',
    enum: ['IMPORT', 'EXPORT'],
    required: true,
    note: 'Loại phiếu nhập/xuất',
  },
  recordCode: {
    type: 'string',
    required: true,
    unique: true,
    maxLength: 100,
  },
  scheduledDatetime: {
    type: 'datetime',
    required: true,
    note: 'Thời gian dự kiến thực hiện',
  },
  actualDatetime: {
    type: 'datetime',
    required: false,
    note: 'Thời gian thực tế thực hiện',
  },
  quantity: {
    type: 'number',
    required: false,
    note: 'Số lượng hàng xử lý (có thể partial)',
  },
  weight: {
    type: 'number',
    required: false,
    note: 'Khối lượng hàng xử lý (kg)',
  },
  isFullZone: {
    type: 'boolean',
    default: false,
    note: 'Đánh dấu nhập/xuất toàn bộ zone',
  },
  responsibleStaffId: {
    type: 'string',
    required: false,
    foreignKey: 'user_id',
    note: 'ref User.user_id - Nhân sự phụ trách thực hiện',
  },
  approvedBy: {
    type: 'string',
    required: false,
    foreignKey: 'user_id',
    note: 'ref User.user_id - Người duyệt phiếu',
  },
  approvedAt: {
    type: 'datetime',
    required: false,
    note: 'Thời điểm duyệt phiếu',
  },
  status: {
    type: 'enum',
    enum: ['PENDING', 'APPROVED', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING',
    note: 'Trạng thái xử lý phiếu',
  },
  cancelReason: {
    type: 'text',
    required: false,
    note: 'Lý do hủy phiếu (nếu status = CANCELLED)',
  },
  notes: {
    type: 'text',
    required: false,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
  updatedAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const indexes = [
  'contract_id',
  'warehouse_id',
  'record_type',
  'scheduled_datetime',
  'status',
];

export const tableName = 'import_export_records';

export default importExportRecordSchema;

