# Shopmaster Product Upsert API

Express + Node.js + SQL Server integration for receiving Shopmaster product and
inventory updates.

It implements:

- `GET /rest/V1/integrations/shopmaster/products` for listing products
- `POST /rest/V1/integrations/shopmaster/products/upsert` for one product
- `POST /rest/V1/integrations/shopmaster/products/bulk-upsert` for up to 15 products
- `GET /health` for a basic unauthenticated health check
- `GET /api-docs` for Swagger UI

## Prerequisites

- Node.js 18+; this project was built against modern Node versions
- SQL Server 2017 or newer
- A `.env` file with your real database details and integration token

## Install

```powershell
npm.cmd install
copy .env.example .env
```

Then edit `.env`.

Important variables:

| Var | Purpose |
| --- | --- |
| `INTEGRATION_TOKEN` | Bearer token Shopmaster sends in the `Authorization` header |
| `DB_SERVER` | SQL Server host, or `host\instance` for a named instance |
| `DB_INSTANCE` | Optional named instance if you do not include it in `DB_SERVER` |
| `DB_PORT` | SQL Server port; use `1433` for normal TCP connections |
| `DB_DATABASE` / `DB_USER` / `DB_PASSWORD` | Database credentials |
| `PORT` | HTTP port, defaults to `3000` |

If `DB_PORT` is set, the app connects by host and port. If `DB_PORT` is blank and
`DB_SERVER` contains `host\instance`, the app connects through the named instance.

## Apply The Database Schema

Run:

```powershell
npm.cmd run db:init
```

This reads `db/schema.sql`, creates missing tables, and seeds:

- The six supported skin types
- `Lagos Flagship Store`
- `Cleanser`, so the bundled samples work

The script is idempotent, so it is safe to run again.

## Run

Production-style:

```powershell
npm.cmd start
```

Development with auto-restart:

```powershell
npm.cmd run dev
```

Expected startup:

```text
[db] connected to your_database
[server] Shopmaster Product API listening on :3000
```

## Test

Swagger UI:

```text
http://localhost:3000/api-docs
```

Health check:

```powershell
curl.exe http://localhost:3000/health
```

Single upsert:

```powershell
curl.exe -X POST http://localhost:3000/rest/V1/integrations/shopmaster/products/upsert `
  -H "Authorization: Bearer YOUR_INTEGRATION_TOKEN" `
  -H "Content-Type: application/json" `
  -H "Idempotency-Key: evt_20260616_0001" `
  --data-binary "@samples/single-upsert.json"
```

Bulk upsert:

```powershell
curl.exe -X POST http://localhost:3000/rest/V1/integrations/shopmaster/products/bulk-upsert `
  -H "Authorization: Bearer YOUR_INTEGRATION_TOKEN" `
  -H "Content-Type: application/json" `
  -H "Idempotency-Key: batch_20260616_001" `
  --data-binary "@samples/bulk-upsert.json"
```

Replace `YOUR_INTEGRATION_TOKEN` with the value in your `.env`.

Fetch all products:

```powershell
curl.exe "http://localhost:3000/rest/V1/integrations/shopmaster/products?page=1&limit=50" `
  -H "Authorization: Bearer YOUR_INTEGRATION_TOKEN"
```

## How It Works

Request flow:

```text
request
  -> auth middleware
  -> idempotency middleware
  -> route validation
  -> transactional product upsert
  -> JSON response
```

The upsert service:

- Resolves category, skin type, brand, location, and tag references
- Inserts or updates the product by `external_product_id`
- Replaces product links for categories, skin types, and tags
- Upserts inventory and the product's one allowed location
- Stores image URLs in `dbo.product_images`
- Queues the image downloader stub after the DB transaction commits

## Images

Shopmaster sends image URLs. Those URLs are stored in SQL Server.

`IMAGE_DOWNLOAD_DIR=./storage/images` is only for the optional future downloader
that would fetch those remote image files and save local copies. In the current
version, no real file download happens; `src/workers/imageDownloader.js` logs the
queued URL and leaves the DB image status as `pending`.

So yes: images are currently URL-based.

## Project Structure

```text
src/
  config/        env.js, db.js
  db/            resolvers.js
  middleware/    auth.js, idempotency.js, errorHandler.js
  routes/        products.routes.js
  schemas/       product.schema.js
  scripts/       initDb.js
  services/      productUpsert.service.js
  workers/       imageDownloader.js
  server.js
db/
  schema.sql
samples/
  single-upsert.json
  bulk-upsert.json
```

## Security Notes

- Do not commit `.env`.
- Use a strong random `INTEGRATION_TOKEN`.
- Rotate any database password that was previously shared in docs or examples.
- Add rate limiting or IP allow-listing before exposing this publicly.
