const ADMIN_EMAIL = "usmaniperfumes27@gmail.com";
const FROM_EMAIL = "Usmani Perfumes <onboarding@resend.dev>";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: "Email service is not configured." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});

    if (body.type === "review") {
      const reviewer = String(body.name ?? "").trim();
      const review = String(body.review ?? "").trim();
      const rating = Number(body.rating) || 0;
      if (!reviewer || !review || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Please provide name, review and a rating from 1 to 5." });
      }
      const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#222"><h2>New Usmani Perfumes Review</h2><p><b>Name:</b> ${esc(reviewer)}<br><b>Rating:</b> ${rating}/5<br><b>Review:</b> ${esc(review)}</p></body></html>`;
      const resend = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { "Authorization": "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM_EMAIL, to: [ADMIN_EMAIL], subject: "New Customer Review — Usmani Perfumes", html, text: "New Customer Review\\nName: " + reviewer + "\\nRating: " + rating + "/5\\nReview: " + review })
      });
      const result = await resend.json().catch(() => ({}));
      if (!resend.ok) { console.error("Resend review error", result); return res.status(502).json({ error: "Email provider rejected the review." }); }
      return res.status(200).json({ ok: true, emailId: result.id });
    }
    const required = ["orderId","name","phone","email","city","area","address"];
    for (const field of required) {
      if (!String(body[field] ?? "").trim()) {
        return res.status(400).json({ error: "Missing required field: " + field });
      }
    }

    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) {
      return res.status(400).json({ error: "No products were included." });
    }

    const total = Number(body.total) || 0;
    const itemRows = items.map(item =>
      '<tr><td style="padding:8px;border-bottom:1px solid #eee">' + esc(item.name) +
      '</td><td style="padding:8px;border-bottom:1px solid #eee">' + esc(item.qty) +
      '</td><td style="padding:8px;border-bottom:1px solid #eee">' + esc(item.price) + '</td></tr>'
    ).join("");

    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#222">
      <h2>New Usmani Perfumes Order</h2>
      <p><b>Order ID:</b> ${esc(body.orderId)}</p>
      <h3>Customer</h3>
      <p><b>Name:</b> ${esc(body.name)}<br>
      <b>Phone:</b> ${esc(body.phone)}<br>
      <b>Email:</b> ${esc(body.email)}<br>
      <b>City:</b> ${esc(body.city)}<br>
      <b>Area:</b> ${esc(body.area)}<br>
      <b>Address:</b> ${esc(body.address)}<br>
      <b>Payment:</b> ${esc(body.payment || "Cash on Delivery")}<br>
      <b>Notes:</b> ${esc(body.notes || "-")}</p>
      <h3>Products</h3>
      <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:650px">
        <thead><tr><th style="text-align:left;padding:8px;background:#f5f5f5">Product</th><th style="text-align:left;padding:8px;background:#f5f5f5">Qty</th><th style="text-align:left;padding:8px;background:#f5f5f5">Price</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <p style="font-size:18px"><b>Product Total: Rs. ${total.toLocaleString()}</b></p>
      <p style="color:#666">Estimated delivery: 3–5 days. Delivery charges depend on city/area.</p>
    </body></html>`;

    const text = [
      "New Usmani Perfumes Order",
      "Order ID: " + body.orderId,
      "Name: " + body.name,
      "Phone: " + body.phone,
      "Email: " + body.email,
      "City: " + body.city,
      "Area: " + body.area,
      "Address: " + body.address,
      "Payment: " + (body.payment || "Cash on Delivery"),
      "Products: " + items.map(x => x.name + " x " + x.qty + " - " + x.price).join("; "),
      "Product Total: Rs. " + total.toLocaleString(),
      "Notes: " + (body.notes || "-")
    ].join("\n");

    const resend = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.RESEND_API_KEY,
        "Content-Type": "application/json",
        "Idempotency-Key": "order-created/" + body.orderId
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ADMIN_EMAIL],
        reply_to: body.email,
        subject: "New Order " + body.orderId + " — Usmani Perfumes",
        html,
        text
      })
    });

    const result = await resend.json().catch(() => ({}));
    if (!resend.ok) {
      console.error("Resend error", result);
      return res.status(502).json({ error: "Email provider rejected the order notification." });
    }

    return res.status(200).json({ ok: true, emailId: result.id });
  } catch (error) {
    console.error("Order API error", error);
    return res.status(500).json({ error: "Could not process the order." });
  }
}