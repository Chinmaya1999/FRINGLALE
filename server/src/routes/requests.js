import { Router } from 'express';
import { z } from 'zod';
import { CustomRequest, Consultation } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError, wrap } from '../utils/http.js';

const r = Router();
const SLOTS = ['10:00-10:30', '11:00-11:30', '12:00-12:30', '14:00-14:30', '15:00-15:30', '16:00-16:30', '17:00-17:30'];
const CAPACITY_PER_SLOT = 2;

r.get('/consultations/slots', wrap(async (req, res) => {
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.query.date);
  const booked = await Consultation.aggregate([{ $match: { date, status: { $ne: 'cancelled' } } }, { $group: { _id: '$slot', n: { $sum: 1 } } }]);
  const map = Object.fromEntries(booked.map((b) => [b._id, b.n]));
  res.json({ date, slots: SLOTS.map((s) => ({ slot: s, available: (map[s] || 0) < CAPACITY_PER_SLOT })) });
}));

r.use(['/custom-requests', '/consultations'], requireAuth);

r.post('/custom-requests', validate(z.object({
  category: z.enum(['ring', 'pendant', 'earring', 'necklace', 'bangle', 'bar', 'coin', 'gold-item', 'other']),
  description: z.string().trim().min(10).max(3000),
  budgetMin: z.number().min(0).optional(), budgetMax: z.number().min(0).optional(),
  files: z.array(z.string().regex(/^\/uploads\/[\w.]+$/)).max(5).default([]),
})), wrap(async (req, res) => {
  res.status(201).json({ request: await CustomRequest.create({ ...req.body, user: req.user._id }) });
}));

r.get('/custom-requests', wrap(async (req, res) => {
  res.json({ items: await CustomRequest.find({ user: req.user._id }).sort({ createdAt: -1 }).lean() });
}));

r.post('/consultations', validate(z.object({
  mode: z.enum(['video', 'store']), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), slot: z.enum(SLOTS),
  request: z.string().optional(),
})), wrap(async (req, res) => {
  if (new Date(req.body.date + 'T23:59:59+05:30') < new Date()) throw new HttpError(422, 'Choose a future date');
  if (req.body.request && !(await CustomRequest.exists({ _id: req.body.request, user: req.user._id }))) throw new HttpError(404, 'Request not found');
  const taken = await Consultation.countDocuments({ date: req.body.date, slot: req.body.slot, status: { $ne: 'cancelled' } });
  if (taken >= CAPACITY_PER_SLOT) throw new HttpError(409, 'That slot was just taken. Please pick another.');
  res.status(201).json({ consultation: await Consultation.create({ ...req.body, user: req.user._id }) });
}));

r.get('/consultations', wrap(async (req, res) => {
  res.json({ items: await Consultation.find({ user: req.user._id }).sort({ date: -1 }).lean() });
}));

export default r;
