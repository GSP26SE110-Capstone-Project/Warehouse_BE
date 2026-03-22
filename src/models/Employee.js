export const employeeSchema = {
  employeeId: {
    type: 'string',
    primaryKey: true,
  },
  userId: {
    type: 'string',
    required: true,
  },
  employeeCode: {
    type: 'string',
    required: true,
    unique: true,
    maxLength: 100,
  },
  warehouseId: {
    type: 'string',
    required: false,
  },
  role: {
    type: 'enum',
    enum: ['warehouse_manager', 'delivery_staff', 'admin'],
    required: true,
  },
  isActive: {
    type: 'boolean',
    default: true,
  },
  hireDate: {
    type: 'date',
    required: true,
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

export const tableName = 'employees';

export default employeeSchema;

