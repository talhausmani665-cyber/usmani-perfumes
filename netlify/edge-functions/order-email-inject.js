export default async (request, context) => {
  const response = await context.next();
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) return response;

  const html = await response.text();
  if (!html.includes('id="checkoutForm"') || html.includes("order-email-inject-marker")) {
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  const script = `
<script id="order-email-inject-marker">
(function(){
  const form=document.getElementById('checkoutForm');
  if(!form) return;
  form.addEventListener('submit',function(){
    try{
      const val=id=>{const el=document.getElementById(id);return el?el.value.trim():''};
      const summary=document.getElementById('checkoutSummary');
      const productBox=summary&&summary.querySelector('div');
      const items=[];
      if(productBox){
        productBox.innerHTML.split('<br>').forEach(line=>{
          const m=line.match(/^(.*?)\\s*[×x]\\s*(\\d+)\\s*[—-]\\s*(.+)$/);
          if(m) items.push({name:m[1].trim(),qty:Number(m[2]),price:m[3].trim()});
        });
      }
      const totalText=summary?summary.textContent.match(/Product Total:\\s*Rs\\.\\s*([0-9,]+)/i):null;
      const total=totalText?Number(totalText[1].replace(/,/g,'')):0;
      const order={
        orderId:'UP-'+Date.now().toString(36).toUpperCase(),
        name:val('customerName'),
        phone:val('customerPhone'),
        email:val('customerEmail'),
        city:val('customerCity'),
        area:val('customerArea'),
        address:val('customerAddress'),
        payment:val('paymentMethod'),
        notes:val('orderNotes'),
        items,
        total,
        createdAt:new Date().toISOString()
      };
      fetch('/.netlify/functions/send-order-email',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(order),
        keepalive:true
      }).then(r=>r.json().catch(()=>({}))).then(d=>{
        if(!d.ok) console.error('Order email failed:',d);
      }).catch(err=>console.error('Order email failed:',err));
    }catch(err){console.error('Order email preparation failed:',err)}
  },true);
})();
</script>`;

  const injected = html.replace(/<\\/body>/i, script + "\\n</body>");
  const headers = new Headers(response.headers);
  return new Response(injected, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export const config = {
  path: "/*",
};
