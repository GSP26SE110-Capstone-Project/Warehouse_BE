/**
 * User Schema - Người dùng hệ thống
 * Có thể là admin, quản lý kho, nhân viên kho, nhân viên vận chuyển, hoặc quản trị viên tenant
 */
export const userSchema = {
  userId: {
    type: 'string',
    primaryKey: true,
  },
  tenantId: {
    type: 'string',
    required: false,
    foreignKey: 'tenant_id',
    note: 'ref Tenant.tenant_id - Null nếu là nhân viên của doanh nghiệp chủ quản (admin)',
  },
  branchId: {
    type: 'string',
    required: false,
    foreignKey: 'branch_id',
    note: 'ref Branch.branch_id - Chi nhánh mà nhân viên này thuộc về',
  },
  username: {
    type: 'string',
    required: true,
    unique: true,
    maxLength: 100,
  },
  passwordHash: {
    type: 'string',
    required: true,
    maxLength: 255,
  },
  fullName: {
    type: 'string',
    required: true,
    maxLength: 255,
  },
  phone: {
    type: 'string',
    required: false,
    maxLength: 20,
  },
  email: {
    type: 'string',
    required: true,
    unique: true,
    maxLength: 255,
  },
  role: {
    type: 'enum',
    enum: [
      'admin',
      'warehouse_staff',
      'transport_staff',
      'tenant_admin'
    ],
    required: true,
    note: 'Vai trò người dùng trong hệ thống',
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

export const tableName = 'users'; // Đồng bộ với tên bảng trong DB

export default userSchema;
