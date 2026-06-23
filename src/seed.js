import pool, { initDatabase } from './db.js';

async function seed() {
  await initDatabase();
  console.log('Starting seed process...');
  console.time('Seeding completed in');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Clear existing products to ensure there are exactly 200,000 clean records
    console.log('Clearing old product data...');
    await client.query('TRUNCATE TABLE products RESTART IDENTITY CASCADE;');

    // Insert 200,000 products using PostgreSQL's generate_series.
    // This executes entirely on the database server, bypassing the network overhead
    // of transmitting 200,000 records from Node.js to PostgreSQL.
    console.log('Generating and inserting 200,000 products...');
    await client.query(`
      INSERT INTO products (name, category, price, created_at, updated_at)
      SELECT
        'Product ' || i,
        (ARRAY['Electronics', 'Clothing', 'Home & Kitchen', 'Books', 'Sports & Outdoors'])[floor(random() * 5) + 1],
        round((random() * 990 + 10)::numeric, 2),
        -- Stagger timestamps into the past (each product is 1 second older than the previous)
        -- This ensures distinct created_at values for clean chronological pagination ordering.
        NOW() - (i || ' seconds')::INTERVAL,
        NOW() - (i || ' seconds')::INTERVAL
      FROM generate_series(1, 200000) s(i);
    `);
    
    await client.query('COMMIT');
    console.log('Transaction committed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during seeding, transaction rolled back:', err);
  } finally {
    client.release();
    console.timeEnd('Seeding completed in');
    await pool.end();
  }
}

seed();
