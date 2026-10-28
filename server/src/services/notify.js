import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { STAGE_LABELS } from './stages.js';

const transport = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;

async function email(to, subject, text) {
  if (!to) return;
  if (!transport) return console.log(`[notify:email-dev] ${to} — ${subject}`);
  await transport.sendMail({ from: process.env.MAIL_FROM || 'Fringlale <no-reply@fringlale.com>', to, subject, text });
}

async function whatsappOrSms(mobile, text) {
  if (!mobile) return;
  // Provider hook (MSG91 / Twilio / WhatsApp Cloud API). Logged until credentials are supplied.
  if (!process.env.WHATSAPP_TOKEN && !process.env.SMS_PROVIDER_KEY) return console.log(`[notify:sms-dev] ${mobile} — ${text}`);
  // TODO(provider): send via configured gateway.
}

/** Fire-and-forget: a notification failure must never fail an order update. */
export function notifyOrder(user, order, event) {
  const label = event === 'placed' ? 'received' : STAGE_LABELS[order.stage] || order.stage;
  const text = `Fringlale: order ${order.orderNo} — ${label}. Track: ${env.clientUrl}/orders/${order._id}`;
  Promise.allSettled([email(user.email, `Order ${order.orderNo}: ${label}`, text), whatsappOrSms(user.mobile, text)])
    .then((r) => r.filter((x) => x.status === 'rejected').forEach((x) => console.error('[notify]', x.reason?.message)));
}
