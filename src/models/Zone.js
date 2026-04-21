/**
 * Zone Schema - Khu vực trong kho
 * Một kho được chia thành nhiều zone (A1, A2, B1, B2, ...)
 * Mỗi zone chứa nhiều rack
 */
export const zoneSchema = {
  zoneId: {
    type: 'string',
    primaryKey: true,
  },
  warehouseId: {
    type: 'string',
    required: true,
    foreignKey: 'warehouse_id',
    note: 'ref Warehouse.warehouse_id - Kho mà zone này thuộc về',
  },
  zoneCode: {
    type: 'string',
    required: true,
    maxLength: 50,
    note: 'Mã zone: A1, A2, B1, B2, ...',
  },
  zoneName: {
    type: 'string',
    required: false,
    maxLength: 255,
  },
  length: {
    type: 'number',
    required: true,
    min: 0.000001,
    note: 'Chiều dài zone (mét)',
  },
  width: {
    type: 'number',
    required: true,
    min: 0.000001,
    note: 'Chiều rộng zone (mét)',
  },
  totalArea: {
    type: 'number',
    required: false,
    min: 0.000001,
    note: 'Diện tích tổng = length x width (m²)',
  },
  isRented: {
    type: 'boolean',
    default: false,
    note: 'Zone đã được thuê hay chưa',
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

export const tableName = 'zones';

export default zoneSchema;

