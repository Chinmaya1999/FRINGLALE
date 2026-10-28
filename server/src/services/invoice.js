import PDFDocument from 'pdfkit';

const inr = (n) => `Rs. ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function streamInvoice(order, user, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  doc.pipe(res);
  doc.fillColor('#0B1F4B').fontSize(22).text('FRINGLALE', { continued: true }).fillColor('#C9A24A').fontSize(10).text('   Make My Jewel — Rootage Group');
  doc.moveDown().fillColor('#000').fontSize(14).text('Tax Invoice');
  doc.fontSize(10).text(`Invoice / Order: ${order.orderNo}`).text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`)
    .text(`Customer: ${user.name || ''} ${user.email || user.mobile || ''}`);
  if (order.address) doc.text(`Ship to: ${[order.address.line1, order.address.city, order.address.state, order.address.pincode].filter(Boolean).join(', ')}`);
  if (order.lockedGoldRate?.date) doc.text(`Gold rate locked on ${order.lockedGoldRate.date}`);
  doc.moveDown();
  for (const it of order.items) {
    const b = it.priceBreakdown || {};
    doc.fontSize(11).fillColor('#0B1F4B').text(`${it.designName} × ${it.qty}`).fillColor('#000').fontSize(9);
    doc.text(`${it.config.metal} · size ${it.config.size}${it.config.stoneType ? ` · ${it.config.stoneType} ${it.config.carat}ct ${it.config.shape} ${it.config.quality}` : ''}`);
    doc.text(`Net weight ${b.finalWeight} g · Metal ${inr(b.metalPrice)} · Making ${inr(b.makingCharge)} · Stone ${inr(b.stonePrice)} · Extras ${inr(b.extras?.total || 0)}`);
    if (it.huid) doc.text(`HUID: ${it.huid}`);
    doc.moveDown(0.5);
  }
  const t = order.priceBreakdown || {};
  doc.moveDown().fontSize(10);
  [['Subtotal', t.subtotal], ['Discount', -(t.discount || 0)], [`GST (${t.gstPercent}%)`, t.gst], ['Shipping', t.shipping]].forEach(([k, v]) => doc.text(`${k}: ${inr(v ?? 0)}`, { align: 'right' }));
  doc.fontSize(13).fillColor('#0B1F4B').text(`Total: ${inr(t.total ?? 0)}`, { align: 'right' });
  doc.fontSize(9).fillColor('#000').text(`Paid: ${inr(order.payment?.paid || 0)}   Due: ${inr(order.payment?.due || 0)}`, { align: 'right' });
  doc.end();
}
