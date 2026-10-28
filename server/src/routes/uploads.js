import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { requireAuth } from '../middleware/auth.js';
import { HttpError, wrap } from '../utils/http.js';

export const UPLOAD_DIR = path.resolve('uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf', 'model/gltf-binary': '.glb' };
// Browsers report .glb as application/octet-stream, so admins may upload GLB by extension.
const extFor = (req, file) =>
  ALLOWED[file.mimetype] || (req.user?.role === 'admin' && /\.glb$/i.test(file.originalname) ? '.glb' : null);
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + extFor(req, file)),
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => (extFor(req, file) ? cb(null, true) : cb(new HttpError(415, 'Unsupported file type'))),
});

const r = Router();
/**
 * Local-disk storage for development and single-server deploys. For production, swap the storage engine
 * for Cloudinary/S3 (set CLOUDINARY_URL) — callers only depend on the returned `url`.
 * GLB files are accepted by browser MIME `model/gltf-binary` or fall back to octet-stream via admin upload.
 */
r.post('/', requireAuth, upload.array('files', 5), wrap(async (req, res) => {
  res.status(201).json({ files: req.files.map((f) => ({ url: `/uploads/${f.filename}`, name: f.originalname, size: f.size })) });
}));
export default r;
