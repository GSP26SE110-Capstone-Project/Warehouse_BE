export const warehouseSchema = {
  warehouseId: {
    type: 'string',
    primaryKey: true,
  },
  branchId: {
    type: 'string',
    required: true,
    foreignKey: 'branch_id',
    note: 'ref Branch.branch_id - Chi nhánh quản lý kho này',
  },
  managerId: {
    type: 'string',
    required: false,
    foreignKey: 'user_id',
    note: 'ref User.user_id - Người quản lý kho',
  },
  warehouseCode: {
    type: 'string',
    required: true,
    unique: true,
    maxLength: 100,
  },
  warehouseName: {
    type: 'string',
    required: true,
    maxLength: 255,
  },
  address: {
    type: 'text',
    required: true,
  },
  district: {
    type: 'string',
    required: false,
  },
  operatingHours: {
    type: 'string',
    required: false,
  },
  length: {
    type: 'number',
    required: true,
    note: 'Chiều dài kho (mét)',
  },
  width: {
    type: 'number',
    required: true,
    note: 'Chiều rộng kho (mét)',
  },
  height: {
    type: 'number',
    required: true,
    note: 'Chiều cao kho (mét)',
  },
  totalArea: {
    type: 'number',
    required: false,
    note: 'Diện tích tổng = length x width (m²)',
  },
  usableArea: {
    type: 'number',
    required: false,
    note: 'Diện tích sử dụng được = totalArea - lối đi',
  },
  occupiedPercent: {
    type: 'number',
    required: false,
    min: 0,
    max: 100,
    note: 'Tỷ lệ không gian đã được thuê (%)',
  },
  occupancyStatus: {
    type: 'enum',
    enum: ['EMPTY', 'PARTIAL', 'FULL'],
    required: false,
    default: 'EMPTY',
    note: 'Trạng thái lấp đầy không gian thuê của kho',
  },
  temperatureMin: {
    type: 'number',
    required: false,
    note: 'Nhiệt độ tối thiểu dự kiến (°C) - cho kho lạnh',
  },
  temperatureMax: {
    type: 'number',
    required: false,
    note: 'Nhiệt độ tối đa dự kiến (°C) - cho kho lạnh',
  },
  isActive: {
    type: 'boolean',
    default: true,
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

export const tableName = 'warehouses';

export default warehouseSchema;

