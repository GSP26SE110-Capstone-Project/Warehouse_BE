import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'

import dotenv from 'dotenv'
dotenv.config();

// Import database connection
import pool from './src/config/db.js'
import userRoutes from './src/routes/UserRoutes.js';
import authRoutes from './src/routes/AuthRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);

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


app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

