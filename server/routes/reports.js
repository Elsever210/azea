const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const config = require('../config');

const router = express.Router();
router.use(authenticate);

// Setup multer
const uploadsDir = path.resolve(config.uploads.dir);
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const allowedMimes = [
  'application/pdf', 'text/csv', 'application/json',
  'image/png', 'image/jpeg',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const upload = multer({
  storage,
  limits: { fileSize: config.uploads.maxSize },
  fileFilter: (req, file, cb) => {
    if (allowedMimes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Unsupported file type'));
  },
});

// GET /api/reports
router.get('/', (req, res) => {
  const db = getDb();
  const search = req.query.q || '';
  let reports;
  if (search) {
    const q = `%${search}%`;
    reports = db.prepare(`
      SELECT * FROM reports WHERE filename LIKE ? OR tag LIKE ? ORDER BY created_at DESC
    `).all(q, q);
  } else {
    reports = db.prepare('SELECT * FROM reports ORDER BY created_at DESC').all();
  }
  // Do not send file_path to client
  reports.forEach(r => delete r.file_path);
  res.json(reports);
});

// POST /api/reports
router.post('/', authorize('admin', 'operator'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File required' });

  const db = getDb();
  const { tag, link_type, link_id } = req.body;

  const info = db.prepare(`
    INSERT INTO reports (filename, mime_type, size, tag, link_type, link_id, file_path, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.file.originalname,
    req.file.mimetype,
    req.file.size,
    tag || '',
    link_type || 'none',
    link_type === 'none' ? null : (parseInt(link_id, 10) || null),
    req.file.path,
    req.user.id
  );

  const report = db.prepare('SELECT id, filename, mime_type, size, tag, link_type, link_id, created_at FROM reports WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(report);
});

// GET /api/reports/:id/download
router.get('/:id/download', (req, res) => {
  const db = getDb();
  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(parseInt(req.params.id, 10));
  if (!report) return res.status(404).json({ error: 'Report not found' });

  if (!fs.existsSync(report.file_path)) {
    return res.status(404).json({ error: 'File not found on disk' });
  }

  res.download(report.file_path, report.filename);
});

// DELETE /api/reports/:id
router.delete('/:id', authorize('admin'), (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id, 10);
  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
  if (!report) return res.status(404).json({ error: 'Report not found' });

  // Remove file from disk
  if (fs.existsSync(report.file_path)) {
    fs.unlinkSync(report.file_path);
  }

  db.prepare('DELETE FROM reports WHERE id = ?').run(id);
  res.json({ message: 'Report deleted' });
});

module.exports = router;
