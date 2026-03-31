// Test script to check imports
import express from 'express';
import tenantRoutes from './src/routes/TenantRoutes.js';
import rentalRequestRoutes from './src/routes/RentalRequestRoutes.js';
import warehouseRoutes from './src/routes/WarehouseRoutes.js';

console.log('All imports successful!');
console.log('Tenant routes:', typeof tenantRoutes);
console.log('Rental request routes:', typeof rentalRequestRoutes);
console.log('Warehouse routes:', typeof warehouseRoutes);