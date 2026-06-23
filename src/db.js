import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('CRITICAL: DATABASE_URL environment variable is not defined.');
  process.exit(1);
}

// Enable SSL for hosted databases like Neon or Supabase
const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false }
});

export const query = (text, params) => pool.query(text, params);

export async function initDatabase() {
  const client = await pool.connect();
  try {
    console.log('Initializing database schema and indexes...');
    
    // Create the products table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexing for fast cursor-based pagination and filtering
    // 1. Default feed ordering: Sort by created_at DESC, then id DESC (to resolve identical timestamps)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_created_at_id 
      ON products (created_at DESC, id DESC);
    `);

    // 2. Category filtered feed ordering: Filter by category, then sort by created_at DESC, id DESC
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_category_created_at_id 
      ON products (category, created_at DESC, id DESC);
    `);

    console.log('Database schema and indexes initialized successfully.');
  } catch (err) {
    console.error('Error during database initialization:', err);
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
