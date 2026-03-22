/**
 * Shipment Schema - Vận chuyển hàng hóa
 * Theo dõi quá trình vận chuyển hàng (nhập/xuất kho)
 */
export const shipmentSchema = {
  shipmentId: {
    type: 'string',
    primaryKey: true,
  },
  contractId: {
    type: 'string',
    required: true,
    note: 'ref Contract.contract_id - Hợp đồng liên quan',
  },
  shipmentType: {
    type: 'enum',
    enum: ['IMPORT', 'EXPORT'],
    required: true,
    note: 'IMPORT = nhập kho, EXPORT = xuất kho',
  },
  providerId: {
    type: 'string',
    required: false,
    note: 'ref TransportProvider.provider_id - Đơn vị vận chuyển',
  },
  driverId: {
    type: 'string',
    required: false,
    note: 'ref User.user_id - Tài xế vận chuyển (null nếu thuê ngoài)',
  },
  supervisorId: {
    type: 'string',
    required: false,
    note: 'ref User.user_id - Quản lý kho giám sát xuất/nhập',
  },
  fromAddress: {
    type: 'text',
    required: true,
    note: 'Địa chỉ xuất phát',
  },
  toAddress: {
    type: 'text',
    required: true,
    note: 'Địa chỉ đến',
  },
  scheduledTime: {
    type: 'datetime',
    required: false,
    note: 'Thời gian dự kiến vận chuyển',
  },
  actualStartTime: {
    type: 'datetime',
    required: false,
    note: 'Thời gian thực tế bắt đầu',
  },
  actualEndTime: {
    type: 'datetime',
    required: false,
    note: 'Thời gian thực tế kết thúc',
  },
  totalWeight: {
    type: 'number',
    required: false,
    note: 'Trọng lượng hàng (kg)',
  },
  totalDistance: {
    type: 'number',
    required: false,
    note: 'Quãng đường vận chuyển (km)',
  },
  shippingFee: {
    type: 'number',
    required: false,
    note: 'Phí vận chuyển (tính theo cân nặng + quãng đường)',
  },
  status: {
    type: 'enum',
    enum: ['SCHEDULING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'],
    default: 'SCHEDULING',
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

export const tableName = 'shipments';

export default shipmentSchema;

