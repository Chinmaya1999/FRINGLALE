// NOTE: policy wording is a sensible starting draft. Have it reviewed by counsel before launch.
export const POLICIES = {
  return: { title: 'Return policy', body: [
    'Made-to-order jewellery (customised by metal, stone, size or engraving) is not eligible for return once production has started, because each piece is made specifically for you.',
    'Before production starts, you approve the CAD and wax model. If you are not happy, request changes or cancel before approving for a refund of amounts paid, less any gateway charges.',
    'If your piece arrives damaged or differs from the approved design, contact us within 48 hours of delivery with photos and we will repair, remake or refund.'] },
  exchange: { title: 'Exchange policy', body: [
    'Lifetime exchange: exchange any Fringlale piece for another at the prevailing gold rate. The metal value is credited at the day’s rate; making charges and stone values are assessed on the piece.',
    'A BIS hallmark and original invoice are required. Stones are credited only against valid certificates and after inspection.'] },
  buyback: { title: 'Buyback & old gold exchange', body: [
    'Bring old gold to a Rootage store or send it insured for assay. Purity is tested by XRF or fire assay in front of you, and the value is calculated at the day’s rate for the tested purity, after melting loss, if any.',
    'The value can be credited towards a new Fringlale order.'] },
  shipping: { title: 'Shipping policy', body: [
    'All orders ship fully insured. Delivery is made against signature and, for high-value orders, OTP verification.',
    'Made-to-order pieces typically take 3–4 weeks after you approve the CAD and wax model. You can follow every stage on your order page.',
    'Balance payment (if you paid an advance) must be cleared before shipping.'] },
  privacy: { title: 'Privacy policy', body: [
    'We collect the details you provide (name, contact, address, designs, uploads) to process orders, deliver and support you. We share data only with payment, logistics and messaging providers needed to fulfil your order.',
    'We do not store card details; payments are processed by Razorpay. You may ask us to access, correct or delete your data by writing to us.'] },
  terms: { title: 'Terms of use', body: [
    'Prices are calculated from the gold rate at the time you start checkout and are locked for 15 minutes. After that, the price may change.',
    '3D previews are illustrative. The studio labels which parts are real 3D assets and which are simulated. Final appearance is confirmed through the CAD and wax model you approve.',
    'Weights are approximate; the final weight may vary slightly and the invoice reflects the actual weight where applicable.'] },
};

export const FAQ = [
  ['How is the price calculated?', 'Metal price (today’s rate × weight) + making charge + stone price + extras, plus 3% GST. The full breakdown is shown live in the studio.'],
  ['What does “price lock” mean?', 'When you start checkout we lock the gold rate for 15 minutes so the price you saw is the price you pay.'],
  ['Will I see my jewel before it is made?', 'Yes. We share a CAD render and wax model photos. Production only starts after you approve.'],
  ['Is the 3D view exactly what I will receive?', 'Not always. The studio tells you which parts are real 3D models, which are visually simulated, and whether the design is approved for manufacturing.'],
  ['Is my jewellery hallmarked?', 'Gold jewellery carries a BIS hallmark with a 6-character HUID, which you can verify.'],
  ['Can I pay in instalments?', 'You can pay an advance now and the balance before shipping.'],
  ['Do you make bars, coins and other gold items?', 'Yes. Gold and silver bars and coins can be ordered by weight with your own engraving, and we make any other gold item to a design you send us through the Custom page. Pricing follows the same live gold rate.'],
  ['Can you make my own design?', 'Yes. Upload a sketch or photo on the Custom page, or book a designer call. We turn it into CAD for your approval and nothing is made until you approve.'],
  ['Can I exchange old gold?', 'Yes, see our buyback policy.'],
];
