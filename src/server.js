import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import pool, { query, initDatabase } from './db.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Helper to encode cursor to base64
function encodeCursor(createdAt, id) {
  const cursorObj = { created_at: createdAt, id: id };
  return Buffer.from(JSON.stringify(cursorObj)).toString('base64');
}

// Helper to decode cursor from base64
function decodeCursor(cursorStr) {
  if (!cursorStr) return null;
  try {
    const raw = Buffer.from(cursorStr, 'base64').toString('utf8');
    const parsed = JSON.parse(raw);
    if (parsed.created_at && parsed.id) {
      return {
        created_at: new Date(parsed.created_at),
        id: parseInt(parsed.id, 10)
      };
    }
  } catch (err) {
    console.warn('Malformed cursor received, ignoring:', cursorStr);
  }
  return null;
}

// GET /api/products - Highly optimized paginated product list
app.get('/api/products', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const category = req.query.category;
    const cursor = decodeCursor(req.query.cursor);

    let sqlQuery = '';
    const queryParams = [];

    // Fetch `limit + 1` rows to determine if there is a next page (avoiding a separate COUNT query)
    const fetchLimit = limit + 1;

    if (category) {
      queryParams.push(category);
      if (cursor) {
        // Query with category filter & starting from the cursor
        // (created_at, id) < (cursor_created_at, cursor_id) is standard PostgreSQL keyset pagination
        queryParams.push(cursor.created_at, cursor.id, fetchLimit);
        sqlQuery = `
          SELECT id, name, category, price, created_at, updated_at
          FROM products
          WHERE category = $1
            AND (created_at, id) < ($2, $3)
          ORDER BY created_at DESC, id DESC
          LIMIT $4;
        `;
      } else {
        // Query with category filter & starting from the beginning
        queryParams.push(fetchLimit);
        sqlQuery = `
          SELECT id, name, category, price, created_at, updated_at
          FROM products
          WHERE category = $1
          ORDER BY created_at DESC, id DESC
          LIMIT $2;
        `;
      }
    } else {
      if (cursor) {
        // Query starting from the cursor, no category filter
        queryParams.push(cursor.created_at, cursor.id, fetchLimit);
        sqlQuery = `
          SELECT id, name, category, price, created_at, updated_at
          FROM products
          WHERE (created_at, id) < ($1, $2)
          ORDER BY created_at DESC, id DESC
          LIMIT $3;
        `;
      } else {
        // Query starting from the beginning, no category filter
        queryParams.push(fetchLimit);
        sqlQuery = `
          SELECT id, name, category, price, created_at, updated_at
          FROM products
          ORDER BY created_at DESC, id DESC
          LIMIT $1;
        `;
      }
    }

    const { rows } = await query(sqlQuery, queryParams);

    // Check if the extra element was retrieved to signal next page availability
    const hasMore = rows.length > limit;
    const paginatedItems = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor = null;
    if (hasMore && paginatedItems.length > 0) {
      const lastItem = paginatedItems[paginatedItems.length - 1];
      nextCursor = encodeCursor(lastItem.created_at, lastItem.id);
    }

    res.json({
      success: true,
      data: paginatedItems,
      has_more: hasMore,
      next_cursor: nextCursor,
      count: paginatedItems.length
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/products - Create a new product (useful for testing pagination stability)
app.post('/api/products', async (req, res) => {
  try {
    const { name, category, price } = req.body;
    if (!name || !category || price === undefined) {
      return res.status(400).json({ success: false, error: 'Missing name, category, or price' });
    }

    const insertQuery = `
      INSERT INTO products (name, category, price, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING *;
    `;
    const { rows } = await query(insertQuery, [name, category, parseFloat(price)]);

    res.status(201).json({
      success: true,
      data: rows[0]
    });
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/categories - Helper to populate the frontend filter options
app.get('/api/categories', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT DISTINCT category 
      FROM products 
      ORDER BY category ASC;
    `);
    res.json({
      success: true,
      data: rows.map(r => r.category)
    });
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Initialize DB schema and start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser to view the client.`);
  });
}).catch(err => {
  console.error('Failed to initialize database schema, server not started.', err);
  process.exit(1);
});
