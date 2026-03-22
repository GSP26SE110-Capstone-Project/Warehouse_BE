export const systemLogSchema = {
  logId: {
    type: 'string',
    primaryKey: true,
  },
  userId: {
    type: 'string',
    required: false,
  },
  actionType: {
    type: 'enum',
    enum: ['create', 'update', 'delete', 'login', 'logout'],
    required: false,
  },
  entityType: {
    type: 'string',
    required: false,
  },
  entityId: {
    type: 'string',
    required: false,
  },
  description: {
    type: 'text',
    required: false,
  },
  ipAddress: {
    type: 'string',
    required: false,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'system_logs';

export default systemLogSchema;

