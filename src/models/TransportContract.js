/**
 * TransportContract Schema - Hợp đồng vận chuyển
 * Tách riêng khỏi hợp đồng thuê kho cho flow vận chuyển.
 */
export const transportContractSchema = {
  transportContractId: {
    type: 'string',
    primaryKey: true,
  },
  shipmentRequestId: {
    type: 'string',
    required: true,
    foreignKey: 'request_id',
  },
  tenantId: {
    type: 'string',
    required: true,
    foreignKey: 'tenant_id',
  },
  contractCode: {
    type: 'string',
    required: true,
    unique: true,
    maxLength: 50,
  },
  fileUrl: {
    type: 'string',
    required: false,
    maxLength: 1000,
  },
  sentBy: {
    type: 'string',
    required: false,
    foreignKey: 'user_id',
  },
  sentAt: {
    type: 'datetime',
    required: false,
  },
  signedBy: {
    type: 'string',
    required: false,
    foreignKey: 'user_id',
  },
  signedAt: {
    type: 'datetime',
    required: false,
  },
  status: {
    type: 'enum',
    enum: ['DRAFT', 'SENT_TO_TENANT', 'SIGNED_BY_TENANT', 'CANCELLED'],
    default: 'DRAFT',
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

export const tableName = 'transport_contracts';

export default transportContractSchema;

