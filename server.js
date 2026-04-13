import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'

import dotenv from 'dotenv'
dotenv.config();
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './src/config/swagger.js';

// Import database connection
import pool from './src/config/db.js'
import userRoutes from './src/routes/UserRoutes.js';
import authRoutes from './src/routes/AuthRoutes.js';
import tenantRoutes from './src/routes/TenantRoutes.js';
import rentalRequestRoutes from './src/routes/RentalRequestRoutes.js';
import warehouseRoutes from './src/routes/WarehouseRoutes.js';
import zoneRoutes from './src/routes/ZoneRoutes.js';
import contractRoutes from './src/routes/ContractRoutes.js';
import contractItemRoutes from './src/routes/ContractItemRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/rental-requests', rentalRequestRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/contract-items', contractItemRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});


app.get('/', (req, res) => {
  res.json({ 
    message: 'Smart Warehouse API',
    version: '1.0.0'
  });
});


app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: err.message 
  });
});


const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Swagger Docs: http://${HOST}:${PORT}/api-docs`);
});

server.on('error', (err) => {
  console.error('HTTP server error:', err);
});// Keep an explicit strong reference for runtimes that aggressively clean up unreferenced handles.
globalThis.__smartWarehouseServer = server;
