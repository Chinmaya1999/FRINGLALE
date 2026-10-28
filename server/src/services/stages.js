import { STAGES } from '../models/Order.js';

export const STAGE_LABELS = {
  order_placed: 'Order Placed', design_cad_ready: 'Design / CAD Ready', customer_approval: 'Customer Approval',
  wax_model: 'Wax Model', casting: 'Casting', stone_setting: 'Stone Setting', polishing: 'Polishing',
  hallmarking: 'Hallmarking (HUID)', quality_check: 'Quality Check', shipped: 'Shipped', delivered: 'Delivered',
};

const APPROVAL_IDX = STAGES.indexOf('customer_approval');

/**
 * Rules for moving an order to `target`.
 *  - Forward one stage at a time (admin may step back one to correct a mistake).
 *  - Production (anything after customer_approval) is blocked until the customer approves.
 *  - Entering customer_approval needs CAD/wax media to show the customer.
 *  - hallmarking -> quality_check needs a HUID; shipping needs a tracking number and a fully-paid order.
 * Returns an error string, or null when allowed.
 */
export function checkTransition(order, target) {
  const from = STAGES.indexOf(order.stage), to = STAGES.indexOf(target);
  if (to < 0) return 'Unknown stage';
  if (to === from) return 'Order is already at this stage';
  if (to > from + 1) return 'Stages cannot be skipped';
  if (from === 0 && to === 1 && !(order.payment?.paid > 0)) return 'No payment received yet';
  if (to < from - 1) return 'Can only step back one stage';
  if (to > APPROVAL_IDX && order.approval?.status !== 'approved') {
    return 'Production cannot continue until the customer approves the design';
  }
  if (target === 'customer_approval' && !order.approval?.media?.length) {
    return 'Upload a CAD render or wax photo before requesting approval';
  }
  if (target === 'quality_check' && !order.huid) return 'Enter the HUID before quality check';
  if (target === 'shipped') {
    if (!order.trackingNumber) return 'Add a tracking number before shipping';
    if (order.payment?.status !== 'paid') return 'Balance payment is pending';
  }
  return null;
}
