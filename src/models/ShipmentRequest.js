/**
 * ShipmentRequest Schema - Yêu cầu vận chuyển từ tenant
 * Tenant tạo yêu cầu, quản lý kho duyệt hoặc từ chối.
 */
export const shipmentRequestSchema = {
  requestId: {
    type: 'string',
    primaryKey: true,
  },
  contractId: {
    type: 'string',
    required: true,
    foreignKey: 'contract_id',
    note: 'ref Contract.contract_id',
  },
  tenantId: {
    type: 'string',
    required: true,
    foreignKey: 'tenant_id',
    note: 'ref Tenant.tenant_id',
  },
  shipmentType: {
    type: 'enum',
    enum: ['IMPORT', 'EXPORT'],
    required: true,
  },
  fromAddress: {
    type: 'text',
    required: true,
  },
  toAddress: {
    type: 'text',
    required: true,
  },
  preferredPickupTime: {
    type: 'datetime',
    required: false,
  },
  notes: {
    type: 'text',
    required: false,
  },
  status: {
    type: 'enum',
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
  },
  reviewedBy: {
    type: 'string',
    required: false,
    foreignKey: 'user_id',
    note: 'Quản lý kho duyệt/từ chối',
  },
  approvedAt: {
    type: 'datetime',
    required: false,
  },
  rejectedReason: {
    type: 'text',
    required: false,
  },
  shipmentId: {
    type: 'string',
    required: false,
    foreignKey: 'shipment_id',
    note: 'Shipment được tạo khi request được duyệt',
  },
  transportContractId: {
    type: 'string',
    required: false,
    foreignKey: 'transport_contract_id',
    note: 'Hop dong van chuyen duoc tao khi request duoc duyet',
  },
  createdBy: {
    type: 'string',
    required: true,
    foreignKey: 'user_id',
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

export const tableName = 'shipment_requests';

export default shipmentRequestSchema;

