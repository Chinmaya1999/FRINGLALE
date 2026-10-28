import { Router } from 'express';
import { z } from 'zod';
import { Design, Metal, Stone, StonePrice, Coupon, Review, Setting, User, Order, CustomRequest, Consultation } from '../models/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError, wrap } from '../utils/http.js';
import { checkTransition } from '../services/stages.js';
import { notifyOrder } from '../services/notify.js';
import bcrypt from 'bcryptjs';
import { designInput, checkDesign } from '../services/designCheck.js';

const r = Router();
r.use(requireAuth);

// ---------- Designer: only assigned requests ----------
r.get('/requests', requireRole('admin', 'designer'), wrap(async (req, res) => {
  const f = req.user.role === 'designer' ? { assignedDesigner: req.user._id } : {};
  res.json({ items: await CustomRequest.find(f).sort({ createdAt: -1 }).populate('user', 'name email mobile').populate('assignedDesigner', 'name').lean() });
}));
r.post('/requests/:id/cad', requireRole('admin', 'designer'), validate(z.object({
  files: z.array(z.string().regex(/^\/uploads\/[\w.]+$/)).min(1).max(10), note: z.string().max(1000).optional(),
})), wrap(async (req, res) => {
  const f = { _id: req.params.id, ...(req.user.role === 'designer' ? { assignedDesigner: req.user._id } : {}) };
  const doc = await CustomRequest.findOne(f);
  if (!doc) throw new HttpError(404, 'Request not found');
  doc.cadFiles.push(...req.body.files);
  doc.status = 'cad_shared';
  if (req.body.note) doc.notes.push({ by: req.user._id, text: req.body.note });
  await doc.save();
  res.json({ request: doc });
}));

// Everything below is admin-only.
r.use(requireRole('admin'));

r.get('/dashboard', wrap(async (_req, res) => {
  const since = new Date(Date.now() - 30 * 86400000);
  const [byStage, revenue, daily, top, counts] = await Promise.all([
    Order.aggregate([{ $group: { _id: '$stage', n: { $sum: 1 } } }]),
    Order.aggregate([{ $group: { _id: null, revenue: { $sum: '$payment.paid' }, orders: { $sum: 1 } } }]),
    Order.aggregate([{ $match: { createdAt: { $gte: since }, 'payment.paid': { $gt: 0 } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, sales: { $sum: '$payment.paid' }, orders: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Order.aggregate([{ $unwind: '$items' }, { $group: { _id: '$items.designName', units: { $sum: '$items.qty' } } }, { $sort: { units: -1 } }, { $limit: 5 }]),
    Promise.all([User.countDocuments({ role: 'customer' }), CustomRequest.countDocuments({ status: 'new' }), Consultation.countDocuments({ status: 'booked' })]),
  ]);
  res.json({
    ordersByStage: byStage, revenue: revenue[0]?.revenue || 0, orderCount: revenue[0]?.orders || 0, daily, topDesigns: top,
    customers: counts[0], newRequests: counts[1], pendingConsultations: counts[2],
  });
}));

// ---------- Catalogue CRUD (every body is validated; unknown fields are rejected) ----------
const oid = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
function crud(path, Model, schema, update = schema.partial?.() ?? schema, { sort = { createdAt: -1 }, allowDelete = true } = {}) {
  r.get(`/${path}`, wrap(async (_req, res) => res.json({ items: await Model.find().sort(sort).lean() })));
  r.post(`/${path}`, validate(schema), wrap(async (req, res) => res.status(201).json({ item: await Model.create(req.body) })));
  r.put(`/${path}/:id`, validate(update), wrap(async (req, res) => {
    const item = await Model.findByIdAndUpdate(oid.parse(req.params.id), req.body, { new: true, runValidators: true });
    if (!item) throw new HttpError(404, 'Not found');
    res.json({ item });
  }));
  if (allowDelete) r.delete(`/${path}/:id`, wrap(async (req, res) => {
    await Model.findByIdAndDelete(oid.parse(req.params.id));
    res.status(204).end();
  }));
}
const metalInput = z.object({ key: z.string().min(2).max(40), family: z.enum(['yellow', 'white', 'rose', 'platinum', 'silver']), karat: z.string().max(10).optional(), label: z.string().max(60), purity: z.number().min(0).max(1).optional(), rateKey: z.enum(['24K', '22K', '18K', '14K', 'platinum', 'silver']), densityFactor: z.number().positive().max(5), hex: z.string().regex(/^#[0-9a-f]{6}$/i).optional(), roughness: z.number().min(0).max(1).optional(), isActive: z.boolean().optional() }).strict();
const stoneInput = z.object({ key: z.string().min(2).max(40), label: z.string().max(60), kind: z.enum(['diamond', 'gem']), ior: z.number().min(1).max(3).optional(), hex: z.string().regex(/^#[0-9a-f]{6}$/i).optional(), certified: z.boolean().optional(), isActive: z.boolean().optional() }).strict();
const stonePriceInput = z.object({ stoneType: z.string().min(2).max(40), shape: z.string().min(2).max(40), quality: z.string().min(1).max(20), pricePerCarat: z.number().positive().max(1e8) }).strict();
const couponBase = z.object({ code: z.string().regex(/^[A-Za-z0-9_-]{3,30}$/), type: z.enum(['percent', 'flat']), value: z.number().positive().max(1e7), maxDiscount: z.number().positive().optional(), minOrder: z.number().min(0).optional(), validFrom: z.coerce.date().optional(), validTo: z.coerce.date().optional(), usageLimit: z.number().int().positive().optional(), isActive: z.boolean().optional() }).strict();
const couponRule = [(c) => !c.type || c.type !== 'percent' || c.value == null || c.value <= 100, { message: 'A percent coupon cannot exceed 100', path: ['value'] }];
const couponInput = couponBase.refine(...couponRule);
const couponUpdate = couponBase.partial().refine(...couponRule);
const reviewInput = z.object({ approved: z.boolean() }).strict();

crud('metals', Metal, metalInput);
crud('stones', Stone, stoneInput);
crud('stone-prices', StonePrice, stonePriceInput);
crud('coupons', Coupon, couponInput, couponUpdate);
r.get('/reviews', wrap(async (_req, res) => res.json({ items: await Review.find().sort({ createdAt: -1 }).limit(200).lean() })));
r.put('/reviews/:id', validate(reviewInput), wrap(async (req, res) => res.json({ item: await Review.findByIdAndUpdate(oid.parse(req.params.id), req.body, { new: true }) })));
r.delete('/reviews/:id', wrap(async (req, res) => { await Review.findByIdAndDelete(oid.parse(req.params.id)); res.status(204).end(); }));

// ---------- Designs: validated, and a design can only go live if it can actually be priced ----------
r.get('/designs', wrap(async (_req, res) => res.json({ items: await Design.find().sort({ createdAt: -1 }).lean() })));
r.get('/designs/:id', wrap(async (req, res) => {
  const d = await Design.findById(oid.parse(req.params.id)).lean();
  if (!d) throw new HttpError(404, 'Not found');
  res.json({ design: d, problems: await checkDesign(d) });
}));
r.post('/designs/check', validate(designInput), wrap(async (req, res) => res.json({ problems: await checkDesign(req.body) })));
async function saveDesign(req, res, existing) {
  const problems = await checkDesign(req.body);
  if (req.body.isActive && problems.some((p) => p.level === 'error')) {
    throw Object.assign(new HttpError(422, 'This design cannot go live yet. Fix the errors, or save it as inactive.', 'DESIGN_INVALID'), { problems });
  }
  const doc = existing ? Object.assign(existing, req.body) : new Design({ ...req.body, manufacturing: { status: 'concept' } });
  await doc.save();
  res.status(existing ? 200 : 201).json({ design: doc, problems });
}
r.post('/designs', validate(designInput), wrap((req, res) => saveDesign(req, res, null)));
r.put('/designs/:id', validate(designInput), wrap(async (req, res) => {
  const d = await Design.findById(oid.parse(req.params.id));
  if (!d) throw new HttpError(404, 'Not found');
  return saveDesign(req, res, d);
}));
// Designs referenced by orders are only ever deactivated, never deleted.
r.delete('/designs/:id', wrap(async (req, res) => {
  const id = oid.parse(req.params.id);
  if (await Order.exists({ 'items.design': id })) {
    await Design.updateOne({ _id: id }, { isActive: false });
    return res.json({ archived: true });
  }
  await Design.deleteOne({ _id: id });
  res.json({ deleted: true });
}));

// Manufacturing approval is its own audited action, never a side effect of editing a design.
r.post('/designs/:id/manufacturing', validate(z.object({ status: z.enum(['concept', 'cad_ready', 'approved_for_manufacturing']) })), wrap(async (req, res) => {
  const d = await Design.findById(req.params.id);
  if (!d) throw new HttpError(404, 'Not found');
  if (req.body.status === 'approved_for_manufacturing' && !d.model3d?.primaryGlbUrl && !d.images?.length) {
    throw new HttpError(422, 'Attach a model or images before approving for manufacturing');
  }
  d.manufacturing = { status: req.body.status, approvedAt: req.body.status === 'approved_for_manufacturing' ? new Date() : undefined, approvedBy: req.user._id };
  await d.save();
  res.json({ design: d });
}));

// ---------- Settings & CMS ----------
r.get('/settings', wrap(async (_req, res) => res.json({ items: await Setting.find().lean() })));
r.put('/settings/:key', validate(z.object({ value: z.any() })), wrap(async (req, res) => {
  const s = await Setting.findOneAndUpdate({ key: req.params.key }, { value: req.body.value }, { upsert: true, new: true });
  res.json({ setting: s });
}));

// ---------- Orders ----------
r.get('/orders', wrap(async (req, res) => {
  const f = req.query.stage ? { stage: String(req.query.stage) } : {};
  res.json({ items: await Order.find(f).sort({ createdAt: -1 }).limit(200).populate('user', 'name email mobile').lean() });
}));
r.get('/orders/:id', wrap(async (req, res) => {
  const o = await Order.findById(req.params.id).populate('user', 'name email mobile').lean();
  if (!o) throw new HttpError(404, 'Not found');
  res.json({ order: o });
}));

r.post('/orders/:id/stage', validate(z.object({ stage: z.string(), note: z.string().max(500).optional() })), wrap(async (req, res) => {
  const o = await Order.findById(req.params.id);
  if (!o) throw new HttpError(404, 'Not found');
  const err = checkTransition(o, req.body.stage);
  if (err) throw new HttpError(422, err, 'STAGE_BLOCKED');
  o.stage = req.body.stage;
  if (o.stage === 'customer_approval') { o.approval.status = 'pending'; o.approval.comment = undefined; o.approval.decidedAt = undefined; }
  o.stageHistory.push({ stage: o.stage, by: req.user._id, note: req.body.note });
  await o.save();
  notifyOrder(await User.findById(o.user), o, 'stage');
  res.json({ order: o });
}));

r.patch('/orders/:id', validate(z.object({
  huid: z.string().regex(/^[A-Z0-9]{6}$/, 'HUID is 6 alphanumeric characters').optional(),
  trackingNumber: z.string().max(60).optional(), courier: z.string().max(40).optional(),
  approvalMedia: z.array(z.string().regex(/^\/uploads\/[\w.]+$/)).max(10).optional(),
  certificates: z.array(z.object({ name: z.string().max(80), url: z.string().regex(/^\/uploads\/[\w.]+$/) })).max(10).optional(),
}).strict()), wrap(async (req, res) => {
  const o = await Order.findById(req.params.id);
  if (!o) throw new HttpError(404, 'Not found');
  const { approvalMedia, certificates, ...rest } = req.body;
  Object.assign(o, rest);
  if (rest.huid) o.items.forEach((i) => { i.huid = rest.huid; });
  if (approvalMedia) {
    o.approval.media.push(...approvalMedia);
    // Customer asked for changes and new media arrived → re-open approval.
    if (o.stage === 'customer_approval' && o.approval.status === 'changes_requested') o.approval.status = 'pending';
  }
  if (certificates) o.certificates.push(...certificates);
  await o.save();
  res.json({ order: o });
}));

// ---------- Requests, consultations, people ----------
r.post('/requests/:id/assign', validate(z.object({ designerId: z.string() })), wrap(async (req, res) => {
  const d = await User.findOne({ _id: req.body.designerId, role: 'designer' });
  if (!d) throw new HttpError(422, 'Not a designer');
  const doc = await CustomRequest.findByIdAndUpdate(req.params.id, { assignedDesigner: d._id, status: 'assigned' }, { new: true });
  res.json({ request: doc });
}));
r.get('/consultations', wrap(async (_req, res) => {
  res.json({ items: await Consultation.find().sort({ date: -1 }).populate('user', 'name email mobile').lean() });
}));
r.put('/consultations/:id', validate(z.object({
  status: z.enum(['booked', 'confirmed', 'completed', 'cancelled']).optional(), assignedDesigner: z.string().optional(), meetingLink: z.string().max(300).regex(/^https:\/\/[^\s]+$/, 'Must be an https link').optional(),
})), wrap(async (req, res) => res.json({ item: await Consultation.findByIdAndUpdate(req.params.id, req.body, { new: true }) })));

// ---------- People ----------
r.get('/customers', wrap(async (_req, res) => res.json({ items: await User.find({ role: 'customer' }).sort({ createdAt: -1 }).limit(200).select('name email mobile createdAt isActive').lean() })));
r.get('/designers', wrap(async (_req, res) => res.json({ items: await User.find({ role: 'designer' }).select('name email').lean() })));
r.get('/users', wrap(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  const f = q ? { $or: ['name', 'email', 'mobile'].map((k) => ({ [k]: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })) } : {};
  res.json({ items: await User.find(f).sort({ createdAt: -1 }).limit(200).select('name email mobile role isActive createdAt').lean() });
}));
r.post('/users', validate(z.object({ name: z.string().trim().min(2).max(80), email: z.string().email().toLowerCase(), password: z.string().min(8).max(100), role: z.enum(['designer', 'admin']) }).strict()), wrap(async (req, res) => {
  if (await User.exists({ email: req.body.email })) throw new HttpError(409, 'Email already registered');
  const { password, ...rest } = req.body;
  const u = await User.create({ ...rest, passwordHash: await bcrypt.hash(password, 12) });
  res.status(201).json({ user: { id: u._id, name: u.name, email: u.email, role: u.role } });
}));
async function lastAdminGuard(userId) {
  const target = await User.findById(userId);
  if (target?.role === 'admin' && (await User.countDocuments({ role: 'admin', isActive: true, _id: { $ne: target._id } })) === 0) {
    throw new HttpError(422, 'You cannot remove or disable the last active admin');
  }
}
r.post('/users/:id/role', validate(z.object({ role: z.enum(['customer', 'designer', 'admin']) }).strict()), wrap(async (req, res) => {
  const id = oid.parse(req.params.id);
  if (String(req.user._id) === id) throw new HttpError(422, 'You cannot change your own role');
  if (req.body.role !== 'admin') await lastAdminGuard(id);
  const out = await User.updateOne({ _id: id }, { role: req.body.role, $inc: { tokenVersion: 1 } });   // old tokens stop working at once
  if (!out.matchedCount) throw new HttpError(404, 'Not found');
  res.json({ ok: true });
}));
r.post('/users/:id/active', validate(z.object({ isActive: z.boolean() }).strict()), wrap(async (req, res) => {
  const id = oid.parse(req.params.id);
  if (String(req.user._id) === id) throw new HttpError(422, 'You cannot disable your own account');
  if (!req.body.isActive) await lastAdminGuard(id);
  const out = await User.updateOne({ _id: id }, { isActive: req.body.isActive, $inc: { tokenVersion: 1 } });
  if (!out.matchedCount) throw new HttpError(404, 'Not found');
  res.json({ ok: true });
}));

export default r;
