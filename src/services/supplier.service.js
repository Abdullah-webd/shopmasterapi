/**
 * Supplier service — writes to existing dbo.Suppliers.
 */
import { sql, getPool } from "../config/db.js";

export async function upsertSupplier(supplier) {
  const pool = await getPool();

  const existing = await pool.request()
    .input("sid", sql.NVarChar(20), supplier.supplierid)
    .query("SELECT SupplierID FROM dbo.Suppliers WHERE SupplierID = @sid");

  const exists = existing.recordset.length > 0;
  const operation = exists ? "updated" : "created";

  if (exists) {
    await pool.request()
      .input("sid", sql.NVarChar(20), supplier.supplierid)
      .input("name", sql.NVarChar(60), supplier.suppliername || null)
      .input("addr1", sql.NVarChar(75), supplier.address || null)
      .input("city", sql.NVarChar(50), supplier.city || null)
      .input("state", sql.NVarChar(50), supplier.state || null)
      .input("phone", sql.NVarChar(30), supplier.phone || null)
      .input("email", sql.NVarChar(30), supplier.email || null)
      .query(`
        UPDATE dbo.Suppliers SET
          SupplierName = @name, AddressLine1 = @addr1,
          City = @city, State = @state,
          PhoneNo1 = @phone, Email = @email
        WHERE SupplierID = @sid
      `);
  } else {
    await pool.request()
      .input("sid", sql.NVarChar(20), supplier.supplierid)
      .input("name", sql.NVarChar(60), supplier.suppliername)
      .input("addr1", sql.NVarChar(75), supplier.address || null)
      .input("city", sql.NVarChar(50), supplier.city || null)
      .input("state", sql.NVarChar(50), supplier.state || null)
      .input("phone", sql.NVarChar(30), supplier.phone || null)
      .input("email", sql.NVarChar(30), supplier.email || null)
      .query(`
        INSERT INTO dbo.Suppliers (SupplierID, SupplierName, AddressLine1, City, State, PhoneNo1, Email)
        VALUES (@sid, @name, @addr1, @city, @state, @phone, @email)
      `);
  }

  return {
    operation,
    supplier: {
      supplierid: supplier.supplierid,
      suppliername: supplier.suppliername,
    },
  };
}
