// Sử dụng pg (node-postgres)
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  // Ưu tiên dùng cấu hình riêng biệt (cho local dev)
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST || 'postgres', // Docker dùng 'postgres', local dùng 'localhost'
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: Number(process.env.POSTGRES_PORT || 5432),
  
  // Fallback: dùng connection string nếu có (cho Docker)
  // connectionString: process.env.DATABASE_URL,
});

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