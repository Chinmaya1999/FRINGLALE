import { Router } from 'express';
import { z } from 'zod';
import { User, Review, Order, Setting, Design } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError, wrap } from '../utils/http.js';

const r = Router();

// Public CMS (banners, testimonials).
r.get('/cms/:key', wrap(async (req, res) => {
  if (!['banners', 'testimonials'].includes(req.params.key)) throw new HttpError(404, 'Not found');
  const s = await Setting.findOne({ key: `cms:${req.params.key}` }).lean();
  res.json({ items: s?.value || [] });
}));

r.get('/reviews', wrap(async (req, res) => {
  const f = { approved: true };
  if (req.query.design) f.design = req.query.design;
  res.json({ items: await Review.find(f).sort({ createdAt: -1 }).limit(30).populate('user', 'name').lean() });
}));

r.use(['/account', '/wishlist'], requireAuth);

r.get('/account', wrap(async (req, res) => {
  const u = await User.findById(req.user._id).populate('wishlist', 'slug name images category').lean();
  res.json({ user: { id: u._id, name: u.name, email: u.email, mobile: u.mobile, savedRingSize: u.savedRingSize, addresses: u.addresses, wishlist: u.wishlist, role: u.role } });
}));

r.patch('/account', validate(z.object({
  name: z.string().trim().min(2).max(80).optional(), savedRingSize: z.string().max(5).optional(),
  email: z.string().email().optional(),
}).strict()), wrap(async (req, res) => {
  Object.assign(req.user, req.body);
  await req.user.save();
  res.json({ ok: true });
}));

const addr = z.object({
  label: z.string().max(30).optional(), name: z.string().min(2).max(80), phone: z.string().regex(/^[6-9]\d{9}$/),
  line1: z.string().min(3).max(200), line2: z.string().max(200).optional(), city: z.string().max(60), state: z.string().max(60),
  pincode: z.string().regex(/^\d{6}$/), isDefault: z.boolean().optional(),
});
r.post('/account/addresses', validate(addr), wrap(async (req, res) => {
  if (req.body.isDefault) req.user.addresses.forEach((a) => { a.isDefault = false; });
  req.user.addresses.push(req.body);
  await req.user.save();
  res.status(201).json({ addresses: req.user.addresses });
}));
r.delete('/account/addresses/:id', wrap(async (req, res) => {
  req.user.addresses.pull({ _id: req.params.id });
  await req.user.save();
  res.json({ addresses: req.user.addresses });
}));

r.put('/wishlist/:designId', wrap(async (req, res) => {
  if (!(await Design.exists({ _id: req.params.designId }))) throw new HttpError(404, 'Design not found');
  await User.updateOne({ _id: req.user._id }, { $addToSet: { wishlist: req.params.designId } });
  res.json({ ok: true });
}));
r.delete('/wishlist/:designId', wrap(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $pull: { wishlist: req.params.designId } });
  res.json({ ok: true });
}));

r.post('/reviews', requireAuth, validate(z.object({
  order: z.string(), rating: z.number().int().min(1).max(5), title: z.string().max(100).optional(), body: z.string().max(1500).optional(),
})), wrap(async (req, res) => {
  const o = await Order.findOne({ _id: req.body.order, user: req.user._id, stage: 'delivered' });
  if (!o) throw new HttpError(403, 'You can review an order once it is delivered');
  if (await Review.exists({ order: o._id, user: req.user._id })) throw new HttpError(409, 'You have already reviewed this order');
  res.status(201).json({ review: await Review.create({ ...req.body, user: req.user._id, design: o.items[0]?.design }) });
}));

export default r;
