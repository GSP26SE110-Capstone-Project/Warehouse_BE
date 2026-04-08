// Sử dụng pg (node-postgres)
import dotenv from 'dotenv';
import pg from 'pg';
const { Pool } = pg;
dotenv.config();

const poolConfig = process.env.DATABASE_URL
  ? {
      // Docker compose đang truyền DATABASE_URL với host nội bộ "postgres"
      connectionString: process.env.DATABASE_URL,
    }
  : {
      // Local dev: dùng biến POSTGRES_* và mặc định host localhost
      user: process.env.POSTGRES_USER,
      host: process.env.POSTGRES_HOST || 'localhost',
      database: process.env.POSTGRES_DB,
      password: process.env.POSTGRES_PASSWORD,
      port: Number(process.env.POSTGRES_PORT || 5432),
    };

const pool = new Pool(poolConfig);

// Function để test connection với retry
async function testConnection(retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await pool.query('SELECT NOW()');
      console.log('Database connected successfully:', result.rows[0]);
      return true;
    } catch (err) {
      console.log(`Database connection attempt ${i + 1}/${retries} failed:`, err.message);
      if (i < retries - 1) {
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('Database connection error after all retries:', err);
        return false;
      }
    }
  }
}

// Test connection với retry
testConnection();

export default pool;