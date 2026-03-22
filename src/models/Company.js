export const companySchema = {
  companyId: {
    type: 'string',
    primaryKey: true,
  },
  userId: {
    type: 'string',
    required: true,
  },
  companyName: {
    type: 'string',
    required: true,
    maxLength: 255,
  },
  taxCode: {
    type: 'string',
    required: true,
    unique: true,
    maxLength: 255,
  },
  address: {
    type: 'text',
    required: false,
  },
  phone: {
    type: 'string',
    required: false,
    maxLength: 50,
  },
  email: {
    type: 'string',
    required: false,
    maxLength: 255,
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

export const tableName = 'companies'; // TODO: đồng bộ tên bảng với DB thực tế

export default companySchema;

