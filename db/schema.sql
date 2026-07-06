-- ============================================================================
-- Shopmaster Product Upsert API — Database Schema
-- Target: SQL Server 2017 (MSSQL)
-- Database: SBasic000
-- Run this once to create all tables, constraints, and seed rows.
-- All statements are idempotent (IF NOT EXISTS checks).
-- GO separators split the file into batches runnable by the Node init script,
-- sqlcmd, or SSMS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Lookup: brands
-- ----------------------------------------------------------------------------
IF OBJECT_ID('dbo.brands', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.brands (
    brand_id     INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    name         NVARCHAR(255) NOT NULL,
    created_at   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_brands_name UNIQUE (name)
  );
END
GO

-- ----------------------------------------------------------------------------
-- 2. Lookup: categories
-- ----------------------------------------------------------------------------
IF OBJECT_ID('dbo.categories', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.categories (
    category_id  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    name         NVARCHAR(255) NOT NULL,
    created_at   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_categories_name UNIQUE (name)
  );
END
GO

-- ----------------------------------------------------------------------------
-- 3. Lookup: skin_types
--    6 fixed labels per the spec: Oily, Dry, Combination, Sensitive, Normal, All Skin Types
-- ----------------------------------------------------------------------------
IF OBJECT_ID('dbo.skin_types', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.skin_types (
    skin_type_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    name         NVARCHAR(100) NOT NULL,
    created_at   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_skin_types_name UNIQUE (name)
  );
END
GO

-- ----------------------------------------------------------------------------
-- 4. Lookup: locations
-- ----------------------------------------------------------------------------
IF OBJECT_ID('dbo.locations', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.locations (
    location_id  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    name         NVARCHAR(255) NOT NULL,
    created_at   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_locations_name UNIQUE (name)
  );
END
GO

-- ----------------------------------------------------------------------------
-- 5. Lookup: tags
-- ----------------------------------------------------------------------------
IF OBJECT_ID('dbo.tags', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.tags (
    tag_id       INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    name         NVARCHAR(255) NOT NULL,
    created_at   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_tags_name UNIQUE (name)
  );
END
GO

-- ----------------------------------------------------------------------------
-- 6. Core: products
--    external_product_id and sku are UNIQUE — enforced at DB level.
--    Lookup uses external_product_id (the parent identity).
-- ----------------------------------------------------------------------------
IF OBJECT_ID('dbo.products', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.products (
    product_id            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    external_product_id   NVARCHAR(100) NOT NULL,
    external_variant_id   NVARCHAR(100) NULL,
    sku                   NVARCHAR(100) NOT NULL,
    name                  NVARCHAR(500) NOT NULL,
    status                NVARCHAR(20) NOT NULL DEFAULT 'active',
    price                 BIGINT NOT NULL,        -- whole Naira, integer
    weight                DECIMAL(10,3) NULL,
    description           NVARCHAR(MAX) NULL,
    ingredients           NVARCHAR(MAX) NULL,
    how_to_use            NVARCHAR(MAX) NULL,
    brand_text            NVARCHAR(255) NULL,     -- raw "brand" name text
    brand_id              INT NULL,
    created_at            DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at            DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_products_external_product_id UNIQUE (external_product_id),
    CONSTRAINT UQ_products_sku                   UNIQUE (sku),
    CONSTRAINT FK_products_brands FOREIGN KEY (brand_id)
      REFERENCES dbo.brands(brand_id),
    CONSTRAINT CK_products_status CHECK
      (status IN ('active','inactive','draft','archived')),
    CONSTRAINT CK_products_price CHECK (price >= 0),
    CONSTRAINT CK_products_weight CHECK (weight IS NULL OR weight >= 0)
  );
END
GO

-- ----------------------------------------------------------------------------
-- 7. Product <-> categories (many-to-many)
-- ----------------------------------------------------------------------------
IF OBJECT_ID('dbo.product_categories', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.product_categories (
    product_id   INT NOT NULL,
    category_id  INT NOT NULL,
    PRIMARY KEY (product_id, category_id),
    CONSTRAINT FK_pc_product FOREIGN KEY (product_id)
      REFERENCES dbo.products(product_id) ON DELETE CASCADE,
    CONSTRAINT FK_pc_category FOREIGN KEY (category_id)
      REFERENCES dbo.categories(category_id)
  );
END
GO

-- ----------------------------------------------------------------------------
-- 8. Product <-> skin_types (many-to-many)
-- ----------------------------------------------------------------------------
IF OBJECT_ID('dbo.product_skin_types', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.product_skin_types (
    product_id     INT NOT NULL,
    skin_type_id   INT NOT NULL,
    PRIMARY KEY (product_id, skin_type_id),
    CONSTRAINT FK_pst_product FOREIGN KEY (product_id)
      REFERENCES dbo.products(product_id) ON DELETE CASCADE,
    CONSTRAINT FK_pst_skin_type FOREIGN KEY (skin_type_id)
      REFERENCES dbo.skin_types(skin_type_id)
  );
END
GO

-- ----------------------------------------------------------------------------
-- 9. Product <-> tags (many-to-many)
-- ----------------------------------------------------------------------------
IF OBJECT_ID('dbo.product_tags', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.product_tags (
    product_id   INT NOT NULL,
    tag_id       INT NOT NULL,
    PRIMARY KEY (product_id, tag_id),
    CONSTRAINT FK_pt_product FOREIGN KEY (product_id)
      REFERENCES dbo.products(product_id) ON DELETE CASCADE,
    CONSTRAINT FK_pt_tag FOREIGN KEY (tag_id)
      REFERENCES dbo.tags(tag_id)
  );
END
GO

-- ----------------------------------------------------------------------------
-- 10. Inventory (one row per product)
-- ----------------------------------------------------------------------------
IF OBJECT_ID('dbo.inventory', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.inventory (
    product_id        INT NOT NULL PRIMARY KEY,
    stock_qty         INT NOT NULL DEFAULT 0,
    low_stock_alert   INT NOT NULL DEFAULT 0,
    updated_at        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_inventory_product FOREIGN KEY (product_id)
      REFERENCES dbo.products(product_id) ON DELETE CASCADE,
    CONSTRAINT CK_inventory_stock CHECK (stock_qty >= 0),
    CONSTRAINT CK_inventory_low_stock CHECK (low_stock_alert >= 0)
  );
END
GO

-- ----------------------------------------------------------------------------
-- 11. Inventory <-> location
--     UNIQUE on product_id enforces "one location per product" at the DB.
-- ----------------------------------------------------------------------------
IF OBJECT_ID('dbo.inventory_locations', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.inventory_locations (
    product_id   INT NOT NULL,
    location_id  INT NOT NULL,
    qty          INT NOT NULL DEFAULT 0,
    PRIMARY KEY (product_id, location_id),
    CONSTRAINT FK_il_product FOREIGN KEY (product_id)
      REFERENCES dbo.products(product_id) ON DELETE CASCADE,
    CONSTRAINT FK_il_location FOREIGN KEY (location_id)
      REFERENCES dbo.locations(location_id),
    CONSTRAINT UQ_il_product_one_location UNIQUE (product_id),
    CONSTRAINT CK_il_qty CHECK (qty >= 0)
  );
END
GO

-- ----------------------------------------------------------------------------
-- 12. Images (URLs stored now; local download is async, status pending)
-- ----------------------------------------------------------------------------
IF OBJECT_ID('dbo.product_images', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.product_images (
    image_id      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    product_id    INT NOT NULL,
    url           NVARCHAR(2048) NOT NULL,
    label         NVARCHAR(255) NULL,
    position      INT NOT NULL DEFAULT 0,
    is_primary    BIT NOT NULL DEFAULT 0,
    local_path    NVARCHAR(2048) NULL,  -- filled by async download worker
    status        NVARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|done|failed
    created_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_pi_product FOREIGN KEY (product_id)
      REFERENCES dbo.products(product_id) ON DELETE CASCADE,
    CONSTRAINT CK_pi_status CHECK (status IN ('pending','done','failed'))
  );
END
GO

-- ----------------------------------------------------------------------------
-- 13. Idempotency store
--     Keyed by Idempotency-Key header. Replays the stored response on retry.
-- ----------------------------------------------------------------------------
IF OBJECT_ID('dbo.idempotency_keys', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.idempotency_keys (
    idempotency_key  NVARCHAR(200) NOT NULL PRIMARY KEY,
    request_hash     NVARCHAR(64) NOT NULL,        -- sha256 of body
    response_status  INT NOT NULL,
    response_body    NVARCHAR(MAX) NOT NULL,
    created_at       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END
GO

-- ----------------------------------------------------------------------------
-- Seed: the 6 accepted skin types (spec labels)
-- ----------------------------------------------------------------------------
SET NOCOUNT ON;
IF NOT EXISTS (SELECT 1 FROM dbo.skin_types)
BEGIN
  INSERT INTO dbo.skin_types (name) VALUES
    (N'Oily'),
    (N'Dry'),
    (N'Combination'),
    (N'Sensitive'),
    (N'Normal'),
    (N'All Skin Types');
END
GO

-- ----------------------------------------------------------------------------
-- Seed: a sample category used by the bundled request examples
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM dbo.categories WHERE name = N'Cleanser')
BEGIN
  INSERT INTO dbo.categories (name) VALUES (N'Cleanser');
END
GO

-- ----------------------------------------------------------------------------
-- Seed: a default location so name-based lookups can resolve (Lagos Flagship)
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM dbo.locations WHERE name = N'Lagos Flagship Store')
BEGIN
  INSERT INTO dbo.locations (name) VALUES (N'Lagos Flagship Store');
END
GO

PRINT 'Schema created successfully.';
GO
