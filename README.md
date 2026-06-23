# ScaleCatalog - High-Performance Cursor Pagination Engine

ScaleCatalog is a highly optimized product catalog API and dashboard designed to handle large-scale datasets (~200,000 products) with sub-10ms query times. It implements **stable keyset (cursor-based) pagination** to guarantee data consistency and eliminate pagination drift (duplicate or skipped items) under heavy concurrent write operations.

## Key Features

*   **Stable Cursor-Based Pagination**: Employs tuple-based queries `(created_at, id) < (cursor_created_at, cursor_id)` to keep the pagination window immune to background insertions.
*   **$O(\log N)$ Query Performance**: Leverages composite B-Tree database indexes to avoid expensive database offsets and sequential scans.
*   **High-Speed Seeding**: Utilizes a database-native generation function (`generate_series`) to populate 200,000 indexed records in under 2 seconds.
*   **Interactive Simulation Dashboard**: Includes a modern, glassmorphic UI equipped with a real-time background traffic generator to visually demonstrate feed stability during scrolling.

---

## Technology Stack

*   **Backend**: Node.js, Express
*   **Database**: PostgreSQL (Neon Serverless / Local)
*   **Frontend**: Vanilla HTML5, CSS3 (Glassmorphism design), ES6 JavaScript
*   **Deployment**: Hosted on Render (API) and Neon (Database)

---

## API Specification

### 1. Get Products
Returns a paginated list of products, sorted chronologically (newest first).

*   **Endpoint**: `GET /api/products`
*   **Query Parameters**:
    *   `limit` (optional): Number of records to return (Default: `20`, Max: `100`).
    *   `category` (optional): Filter products by exact category name.
    *   `cursor` (optional): Base64-encoded pagination cursor containing the coordinates of the last-seen item.
*   **Response Payload**:
    ```json
    {
      "success": true,
      "data": [
        {
          "id": 199997,
          "name": "Product 4",
          "category": "Electronics",
          "price": "439.50",
          "created_at": "2026-06-23T18:59:57.000Z",
          "updated_at": "2026-06-23T18:59:57.000Z"
        }
      ],
      "has_more": true,
      "next_cursor": "eyJjcmVhdGVkX2F0IjoiMjAyNi0wNi0yM1QxODo1OTo1Ny4wMDBaIiwiaWQiOjE5OTk5N30=",
      "count": 1
    }
    ```

### 2. Create Product (Simulation Endpoint)
Inserts a new product into the database. Used to simulate concurrent traffic while scrolling.

*   **Endpoint**: `POST /api/products`
*   **Request Body**:
    ```json
    {
      "name": "Super Fast Hard Drive",
      "category": "Electronics",
      "price": 149.99
    }
    ```

### 3. Get Categories
Retrieves a list of all distinct product categories to populate filter options.

*   **Endpoint**: `GET /api/categories`

---

## Database Schema & Indexing

The schema resides in PostgreSQL with two critical composite indexes:

```sql
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optimized index for the global feed (Newest first)
CREATE INDEX IF NOT EXISTS idx_products_created_at_id 
ON products (created_at DESC, id DESC);

-- Optimized index for the category-filtered feed (Newest first)
CREATE INDEX IF NOT EXISTS idx_products_category_created_at_id 
ON products (category, created_at DESC, id DESC);
```

---

## Setup and Installation

### 1. Prerequisite Installations
*   Node.js (v18 or higher)
*   PostgreSQL instance (Local or Cloud)

### 2. Clone and Install Dependencies
```bash
git clone https://github.com/guptatapan-24/scale-catalog
cd scale-catalog
npm install
```

### 3. Configure Variables
Create a `.env` file in the root directory:
```env
PORT=5000
DATABASE_URL=postgres://username:password@localhost:5432/dbname?sslmode=disable
```

### 4. Seed the Database
Run the following script to create the schema, build indexes, and seed 200,000 items:
```bash
npm run seed
```

### 5. Start the Server
```bash
npm start
```
The server will start on port `5000`. You can access the UI dashboard at `http://localhost:5000`.

---

## Production Deployment

### 1. Database Hosting (Neon)
1. Provision a free PostgreSQL instance on [Neon.tech](https://neon.tech/).
2. Copy the database **Connection String** from the dashboard.

### 2. Web Service Deployment (Render)
1. Create a new **Web Service** on [Render.com](https://render.com/) linked to your repository.
2. Configure settings:
   *   **Runtime**: `Node`
   *   **Build Command**: `npm install`
   *   **Start Command**: `npm start`
3. Under **Advanced**, add the environment variable `DATABASE_URL` with your Neon connection string.
4. Click **Create Web Service**.

### 3. Seeding in Production
1. Navigate to the **Shell** tab on the Render Web Service dashboard.
2. Execute the seed command inside the container shell:
   ```bash
   npm run seed
   ```
