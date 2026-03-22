export const invoiceItemSchema = {
  invoiceItemId: {
    type: 'string',
    primaryKey: true,
  },
  invoiceId: {
    type: 'string',
    required: true,
  },
  description: {
    type: 'text',
    required: true,
  },
  quantity: {
    type: 'number',
    default: 1,
  },
  unitPrice: {
    type: 'number',
    required: true,
  },
  amount: {
    type: 'number',
    required: true,
  },
  relatedEntityType: {
    type: 'string',
    required: false,
  },
  relatedEntityId: {
    type: 'string',
    required: false,
  },
  createdAt: {
    type: 'datetime',
    default: 'NOW()',
  },
};

export const tableName = 'invoice_items';

export default invoiceItemSchema;

