import { sql, getPool } from "../config/db.js";

// ===========================================================================
// Async image download — v1 stub.
//
// The spec says: "We will store the URLs and process image downloads
// asynchronously." The real download logic (HTTP fetch -> disk/blob storage
// -> update product_images.local_path + status) is intentionally left as a
// hook so you can plug in your storage backend (local disk, S3, CDN...).
//
// For now this:
//   1. logs the queued images
//   2. marks each row 'pending' (already the default)
//
// Replace the body of downloadOne() with a real fetch when ready.
// ===========================================================================

export async function enqueueImageDownload(product_id, images) {
  // Fire-and-forget; errors are caught by the caller in the service.
  for (const img of images) {
    await downloadOne(product_id, img).catch((e) =>
      console.error(`[imageDownloader] ${img.url}:`, e.message)
    );
  }
}

async function downloadOne(product_id, img) {
  // TODO: real download. Example sketch:
  //
  //   const res = await fetch(img.url);
  //   if (!res.ok) throw new Error(`HTTP ${res.status}`);
  //   const buf = Buffer.from(await res.arrayBuffer());
  //   const localPath = path.join(env.imageDownloadDir, filename);
  //   await fs.writeFile(localPath, buf);
  //
  // Then persist the local path + mark done:
  //
  //   const pool = await getPool();
  //   await pool.request()
  //     .input('url', sql.NVarChar(2048), img.url)
  //     .input('local', sql.NVarChar(2048), localPath)
  //     .query(`UPDATE dbo.product_images
  //             SET local_path = @local, status = 'done'
  //             WHERE product_id = ... AND url = @url`);

  console.log(
    `[imageDownloader] queued: product_id=${product_id} url=${img.url}`
  );

  // Mark as 'pending' explicitly (already the schema default) so the
  // status is queryable for a future worker poll.
  const pool = await getPool();
  await pool
    .request()
    .input("pid", sql.Int, product_id)
    .input("url", sql.NVarChar(2048), img.url)
    .query(
      `UPDATE dbo.product_images SET status = 'pending'
       WHERE product_id = @pid AND url = @url`
    );
}
