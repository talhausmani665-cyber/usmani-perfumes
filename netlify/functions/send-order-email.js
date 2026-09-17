const OWNER_EMAIL = "usmaniperfumes27@gmail.com";

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!process.env.RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY is not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const order = await req.json();
    const items = Array.isArray(order.items) ? order.items : [];
    const rows = items.map(x => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${esc(x.name)}</td>
        <td style="padding:8px;text-align:center;border-bottom:1px solid #eee">${esc(x.qty)}</td>
        <td style="padding:8px;text-align:right;border-bottom:1px solid #eee">${esc(x.price)}</td>
      </tr>`).join("");

    const html = `
      <h2>New Website Order — Usmani Perfumes</h2>
      <p><b>Order ID:</b> ${esc(order.orderId)}</p>
      <p>
        <b>Name:</b> ${esc(order.name)}<br>
        <b>Phone:</b> ${esc(order.phone)}<br>
        <b>Email:</b> ${esc(order.email)}<br>
        <b>City:</b> ${esc(order.city)}<br>
        <b>Area:</b> ${esc(order.area)}<br>
        <b>Address:</b> ${esc(order.address)}<br>
        <b>Payment:</b> ${esc(order.payment)}<br>
        <b>Notes:</b> ${esc(order.notes || "—")}
      </p>
      <table style="border-collapse:collapse;width:100%">
        <tr>
          <th style="text-align:left">Product</th>
          <th>Qty</th>
          <th style="text-align:right">Price</th>
        </tr>
        ${rows}
      </table>
      <p><b>Product Total: Rs. ${Number(order.total || 0).toLocaleString()}</b></p>`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "Usmani Perfumes <onboarding@resend.dev>",
        to: [OWNER_EMAIL],
        subject: `New Order ${order.orderId || ""} — ${order.name || "Customer"}`,
        html
      })
    });

    const data = await resendResponse.json();

    return new Response(
      JSON.stringify(resendResponse.ok ? { ok: true, id: data.id } : { error: data.message || "Resend rejected the email" }),
      {
        status: resendResponse.ok ? 200 : resendResponse.status,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Order email failed" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
};
