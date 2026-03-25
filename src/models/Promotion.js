/**
 * Promotion Schema - Khuyến mãi/Giảm giá
 * Quản lý các chương trình khuyến mãi, mã discount, etc.
 */
export const promotionSchema = {
  promotionId: {
    type: 'string',
    primaryKey: true,
  },
  promotionCode: {
    type: 'string',
    required: true,
    unique: true,
    maxLength: 50,
  },
  promotionName: {
    type: 'string',
    required: true,
    maxLength: 255,
  },
  description: {
    type: 'text',
    required: false,
  },
  discountType: {
    type: 'enum',
    enum: ['PERCENTAGE', 'FIXED_AMOUNT'],
    required: true,
    note: 'PERCENTAGE = % giảm, FIXED_AMOUNT = giảm cố định (VND)',
  },
  discountValue: {
    type: 'number',
    required: true,
    note: 'Giá trị giảm (% hoặc VND tùy discountType)',
  },
  applicableTo: {
    type: 'enum',
    enum: ['ENTIRE_WAREHOUSE', 'ZONE', 'SLOT', 'ALL'],
    required: true,
    note: 'Áp dụng cho loại nào',
  },
  minRentalDays: {
    type: 'integer',
    required: false,
    note: 'Tối thiểu bao nhiêu ngày mới được áp dụng',
  },
  minRentalValue: {
    type: 'number',
    required: false,
    note: 'Tối thiểu giá trị hợp đồng (VND)',
  },
  maxDiscount: {
    type: 'number',
    required: false,
    note: 'Giảm giá tối đa (VND) - khi discountType = PERCENTAGE',
  },
  validFrom: {
    type: 'date',
    required: true,
  },
  validTo: {
    type: 'date',
    required: true,
  },
  maxUsage: {
    type: 'integer',
    required: false,
    note: 'Số lần tối đa được sử dụng (null = không giới hạn)',
  },
  currentUsage: {
    type: 'integer',
    default: 0,
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

export const tableName = 'promotions';

export default promotionSchema;

