/**
 * Email service using Resend.
 * Sends order notification emails to admins.
 */
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || "onboarding@myschoolmanager.org";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "webmastersmma@gmail.com";

export async function sendOrderEmail(order) {
  const {
    type,            // "purchase" or "sales"
    invoiceno,
    invoicedate,
    productid,
    productname,
    qty,
    costprice,
    sellprice,
    amount,
    supplierid,      // purchase only
    customerid,      // sales only
  } = order;

  const isPurchase = type === "purchase";
  const partyLabel = isPurchase ? "Supplier" : "Customer";
  const partyId = isPurchase ? supplierid : customerid;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2 style="color:#1a1a2e;border-bottom:2px solid #e94560;padding-bottom:10px;">
        ${isPurchase ? "📦 New Stock Purchase" : "🛒 New Sale"}
      </h2>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Invoice No</td>
            <td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${invoiceno}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Date</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${invoicedate}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Product ID</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${productid}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Product</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${productname || "—"}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">${partyLabel}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${partyId || "—"}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Quantity</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${qty}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Cost Price</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">₦${Number(costprice).toLocaleString()}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Sell Price</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">₦${Number(sellprice).toLocaleString()}</td></tr>
        <tr style="background:#f8f9fa;">
            <td style="padding:8px;font-weight:bold;">Total Amount</td>
            <td style="padding:8px;font-weight:bold;color:#e94560;font-size:18px;">₦${Number(amount).toLocaleString()}</td></tr>
      </table>
      <p style="margin-top:20px;color:#999;font-size:12px;">
        This is an automated notification from ShopMaster.
      </p>
    </div>
  `;

  const { data, error } = await resend.emails.send({
    from: `ShopMaster Notifications <${FROM}>`,
    to: [ADMIN_EMAIL],
    subject: `${isPurchase ? "📦 Purchase" : "🛒 Sale"} — ${invoiceno} | ₦${Number(amount).toLocaleString()}`,
    html,
  });

  if (error) {
    console.error("[email] Failed:", error.message);
    throw new Error(`Email send failed: ${error.message}`);
  }

  return { emailId: data.id, sentTo: ADMIN_EMAIL };
}
