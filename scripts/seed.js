/*
 * Seed data toàn cục để test các API Smart Warehouse.
 *
 * Cách chạy:
 *   npm run seed
 *
 * Script idempotent: chạy lại nhiều lần không phát sinh lỗi (ON CONFLICT DO NOTHING).
 * Tất cả user seed đều là is_active = true nên login được ngay:
 *   - admin@test.local           / Password@123   (role: admin)
 *   - whstaff@test.local         / Password@123   (role: warehouse_staff)
 *   - transport@test.local       / Password@123   (role: transport_staff)
 *   - tenant@test.local          / Password@123   (role: tenant_admin)
 *
 * Core IDs được seed:
 *   tenant: TN001
 *   branch: BR001
 *   warehouse: WH0001
 *   zones: ZN0001, ZN0002
 *   rack: RK0001 (thuộc ZN0001)
 *   level: LV0001 (thuộc RK0001)
 *   slot: SL0001, SL0002 (thuộc LV0001)
 *   transport provider: TP001
 *   transport station: TS001
 *   rental_request: RR0001 (APPROVED, WH0001)
 *   contract: CT0001 (ACTIVE)
 *   contract_item: CI0001 (ZONE rent, ZN0002)
 *   pricing_rule: PR0001
 *   promotion: PM0001
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';
import pool from '../src/config/db.js';

const PASSWORD_PLAINTEXT = 'Password@123';

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const passwordHash = await bcrypt.hash(PASSWORD_PLAINTEXT, 10);

    const columnsCache = new Map();
    async function getColumns(table) {
      if (columnsCache.has(table)) return columnsCache.get(table);
      const { rows } = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1;`,
        [table],
      );
      const set = new Set(rows.map((r) => r.column_name));
      columnsCache.set(table, set);
      return set;
    }

    async function dynamicInsert(table, payload, conflictCol) {
      const cols = await getColumns(table);
      const filtered = Object.fromEntries(
        Object.entries(payload).filter(([k]) => cols.has(k)),
      );
      const keys = Object.keys(filtered);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO ${table} (${keys.join(', ')})
         VALUES (${placeholders})
         ON CONFLICT (${conflictCol}) DO NOTHING;`,
        keys.map((k) => filtered[k]),
      );
    }

    // 1) Tenant
    await dynamicInsert('tenants', {
      tenant_id: 'TN001',
      company_name: 'Test Tenant Co.',
      tax_code: '0301234567',
      contact_email: 'tenant-company@test.local',
      contact_phone: '0900000001',
      address: '123 Test Street',
      is_active: true,
    }, 'tenant_id');

    // 2) Branch (manager_id tạm null, sẽ update sau khi có user)
    await dynamicInsert('branches', {
      branch_id: 'BR001',
      branch_code: 'HCM-01',
      branch_name: 'Chi nhánh HCM',
      city: 'Ho Chi Minh',
      address: '123 Branch Street', // legacy column, sẽ tự bỏ nếu đã drop
      is_active: true,
    }, 'branch_id');

    // 3) Users (4 roles)
    const users = [
      { user_id: 'USR001', tenant_id: 'TN001', branch_id: 'BR001', email: 'admin@test.local',     full_name: 'Admin User',      phone: '0901000001', role: 'admin' },
      { user_id: 'USR002', tenant_id: null,    branch_id: 'BR001', email: 'whstaff@test.local',   full_name: 'Warehouse Staff', phone: '0901000002', role: 'warehouse_staff' },
      { user_id: 'USR003', tenant_id: null,    branch_id: 'BR001', email: 'transport@test.local', full_name: 'Transport Staff', phone: '0901000003', role: 'transport_staff' },
      { user_id: 'USR004', tenant_id: 'TN001', branch_id: null,    email: 'tenant@test.local',    full_name: 'Tenant Admin',    phone: '0901000004', role: 'tenant_admin' },
    ];
    for (const u of users) {
      await dynamicInsert('users', {
        user_id: u.user_id,
        tenant_id: u.tenant_id,
        branch_id: u.branch_id,
        username: u.email,
        password_hash: passwordHash,
        full_name: u.full_name,
        phone: u.phone,
        email: u.email,
        role: u.role,
        is_active: true,
        status: 'active', // legacy column nếu có
      }, 'user_id');
    }

    // Gán manager cho branch (warehouse_staff làm manager để test)
    await client.query(
      `UPDATE branches SET manager_id = $1 WHERE branch_id = $2 AND manager_id IS NULL;`,
      ['USR002', 'BR001'],
    );

    // 4) Warehouse
    await dynamicInsert('warehouses', {
      warehouse_id: 'WH0001',
      branch_id: 'BR001',
      manager_id: 'USR002',
      warehouse_code: 'WH-HCM-01',
      warehouse_name: 'Warehouse HCM 01',
      address: '123 Nguyen Van Linh',
      district: 'District 7',
      operating_hours: '08:00-18:00',
      length: 100,
      width: 50,
      height: 12,
      total_area: 5000,
      usable_area: 4500,
      is_active: true,
      // legacy columns (tự bỏ nếu đã drop)
      city: 'Ho Chi Minh',
      warehouse_type: 'normal_storage',
      warehouse_size: 'large',
    }, 'warehouse_id');

    // 5) Zones (2 zones)
    const zones = [
      { zone_id: 'ZN0001', zone_code: 'A', zone_name: 'Zone A', length: 20, width: 10, total_area: 200, is_rented: false },
      { zone_id: 'ZN0002', zone_code: 'B', zone_name: 'Zone B', length: 30, width: 10, total_area: 300, is_rented: false },
    ];
    for (const z of zones) {
      await dynamicInsert('zones', {
        warehouse_id: 'WH0001',
        ...z,
        zone_type: 'normal_storage', // legacy column
      }, 'zone_id');
    }

    // 6) Rack + Level + Slot (trong ZN0001) - insert dynamic để bỏ qua cột chưa migrate
    await dynamicInsert('racks', {
      rack_id: 'RK0001',
      zone_id: 'ZN0001',
      rack_code: 'A-R01',
      rack_size_type: 'medium',
      length: 2.5,
      width: 1.2,
      height: 3,
      max_weight_capacity: 1000,
      is_rented: false,
    }, 'rack_id');

    await dynamicInsert('levels', {
      level_id: 'LV0001',
      rack_id: 'RK0001',
      level_number: 1,
      height_clearance: 1.5,
      max_weight: 500,
      is_rented: false,
    }, 'level_id');

    const slotsData = [
      { slot_id: 'SL0001', slot_code: 'A-R01-L1-S01' },
      { slot_id: 'SL0002', slot_code: 'A-R01-L1-S02' },
    ];
    for (const s of slotsData) {
      await dynamicInsert('slots', {
        slot_id: s.slot_id,
        level_id: 'LV0001',
        slot_code: s.slot_code,
        length: 1.2,
        width: 1.0,
        height: 1.5,
        volume: 1.8,
        status: 'EMPTY',
      }, 'slot_id');
    }

    // 7) Transport provider + station
    await dynamicInsert('transport_providers', {
      provider_id: 'TP001',
      name: 'Test Transport JSC',
      provider_type: 'INTERNAL',
      contact_info: '0911000001',
      is_active: true,
    }, 'provider_id');

    await dynamicInsert('transport_stations', {
      station_id: 'TS001',
      provider_id: 'TP001',
      station_name: 'HCM Central Station',
      address: '456 Vo Van Kiet',
      manager_id: 'USR003',
    }, 'station_id');

    // 8) Rental request (APPROVED) - dùng để tạo contract
    await dynamicInsert('rental_requests', {
      request_id: 'RR0001',
      customer_type: 'business',
      tenant_id: 'TN001',
      warehouse_id: 'WH0001',
      rental_type: 'RACK',
      status: 'APPROVED',
      requested_start_date: new Date(),
      rental_term_unit: 'MONTH',
      rental_term_value: 3,
      duration_days: 90,
      goods_type: 'general_goods',
      goods_description: 'Seed request for testing',
      goods_quantity: 100,
      goods_weight_kg: 500,
      contact_name: 'Tenant Admin',
      contact_phone: '0901000004',
      contact_email: 'tenant@test.local',
      approved_by: 'USR001',
      storage_type: 'normal',
    }, 'request_id');

    // 9) Contract ACTIVE + 1 contract_item (ZONE rent trên ZN0002)
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 90);
    await dynamicInsert('contracts', {
      contract_id: 'CT0001',
      request_id: 'RR0001',
      tenant_id: 'TN001',
      approved_by: 'USR001',
      contract_code: 'CT-2026-0001',
      start_date: today,
      end_date: endDate,
      billing_cycle: 'MONTH',
      rental_duration_days: 90,
      total_rental_fee: 15000000,
      status: 'ACTIVE',
    }, 'contract_id');

    await dynamicInsert('contract_items', {
      item_id: 'CI0001',
      contract_id: 'CT0001',
      rent_type: 'ZONE',
      warehouse_id: 'WH0001',
      zone_id: 'ZN0002',
      unit_price: 5000000,
    }, 'item_id');

    // 10) Pricing rule + Promotion
    await dynamicInsert('pricing_rules', {
      pricing_rule_id: 'PR0001',
      warehouse_id: 'WH0001',
      rent_type: 'ZONE',
      min_days: 1,
      max_days: 365,
      price_per_day: 50000,
      price_per_m2: 10000,
      billing_cycle: 'MONTHLY',
      bulk_discount_pct: 5.0,
      is_active: true,
      effective_from: today,
    }, 'pricing_rule_id');

    const promoEnd = new Date();
    promoEnd.setDate(today.getDate() + 180);
    await dynamicInsert('promotions', {
      promotion_id: 'PM0001',
      promotion_code: 'PROMO10',
      promotion_name: 'Promo 10%',
      description: 'Seed promotion for testing',
      discount_type: 'PERCENTAGE',
      discount_value: 10.0,
      applicable_to: 'ALL',
      min_rental_days: 30,
      min_rental_value: 1000000,
      max_discount: 5000000,
      valid_from: today,
      valid_to: promoEnd,
      max_usage: 100,
      current_usage: 0,
      is_active: true,
    }, 'promotion_id');

    // 11) Shipment mẫu gắn với contract
    const shipmentSchedule = new Date();
    shipmentSchedule.setDate(today.getDate() + 2);
    await dynamicInsert('shipments', {
      shipment_id: 'SH0001',
      contract_id: 'CT0001',
      shipment_type: 'IMPORT',
      provider_id: 'TP001',
      driver_id: 'USR003',
      supervisor_id: 'USR002',
      from_address: '789 Start Street',
      to_address: '123 Nguyen Van Linh',
      scheduled_time: shipmentSchedule,
      status: 'SCHEDULING',
    }, 'shipment_id');

    // 12) Import/Export record (nếu bảng tồn tại)
    const ieSchedule = new Date();
    ieSchedule.setDate(today.getDate() + 1);
    const ieCols = await getColumns('import_export_records');
    if (ieCols.size > 0) {
      await dynamicInsert('import_export_records', {
        record_id: 'IE0001',
        contract_id: 'CT0001',
        warehouse_id: 'WH0001',
        scope_type: 'ZONE',
        zone_id: 'ZN0002',
        record_type: 'IMPORT',
        record_code: 'IE-2026-0001',
        scheduled_datetime: ieSchedule,
        status: 'PENDING',
        responsible_staff_id: 'USR002',
      }, 'record_id');
    }

    // 13) Notification mẫu
    await dynamicInsert('notifications', {
      notification_id: 'NT0001',
      user_id: 'USR004',
      type: 'REQUEST_STATUS',
      title: 'Chào mừng',
      content: 'Tài khoản tenant seed đã sẵn sàng để test.',
      is_read: false,
    }, 'notification_id');

    await client.query('COMMIT');

    console.log('=== SEED DONE ===');
    console.log('Login test accounts (password: Password@123):');
    console.log('  - admin@test.local       (admin)');
    console.log('  - whstaff@test.local     (warehouse_staff)');
    console.log('  - transport@test.local   (transport_staff)');
    console.log('  - tenant@test.local      (tenant_admin)');
    console.log('Core IDs: WH0001, ZN0001/ZN0002, CT0001, RR0001, TP001');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('SEED FAILED:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
