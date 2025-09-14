import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(helmet());
app.use(cors({ origin: '*'}));
app.use(express.json());
app.use(morgan('dev'));

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/securebank';
const MONGO_URI_SOURCE = process.env.MONGO_URI ? 'MONGO_URI' : (process.env.MONGODB_URI ? 'MONGODB_URI' : 'DEFAULT_LOCAL');
const DB_NAME = process.env.DB_NAME || 'securebank';
let db, client;

async function connectMongo() {
  try {
    client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 20000 });
    await client.connect();
    db = client.db(DB_NAME);
    console.log(`Connected to MongoDB (source=${MONGO_URI_SOURCE}, db=${DB_NAME})`);
  } catch (err) {
    console.error(`Mongo connection failed (source=${MONGO_URI_SOURCE}). Ensure the environment variable is set on your host and that your Atlas IP allowlist permits access.`, err.message);
    throw err;
  }
}

// Utility: wrap async routes
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Friendly root message
app.get('/', (req, res) => {
  res.type('text/plain').send('SecureBank API running. See /api/health');
});

// Users
app.get('/api/users', asyncH(async (req, res) => {
  const users = await db.collection('users').find({}).project({ password: 0 }).toArray();
  res.json(users);
}));

app.post('/api/users', asyncH(async (req, res) => {
  const user = { ...req.body, createdAt: new Date(), updatedAt: new Date() };
  const result = await db.collection('users').insertOne(user);
  res.status(201).json({ id: result.insertedId });
}));

// Pending users
app.get('/api/pending-users', asyncH(async (req, res) => {
  const rows = await db.collection('pending_users').find({}).toArray();
  res.json(rows);
}));

app.post('/api/pending-users', asyncH(async (req, res) => {
  const body = req.body || {};
  const doc = {
    name: body.name,
    email: body.email,
    phone: body.phone,
    password: body.password || undefined,
    accountNumber: body.accountNumber,
    routingNumber: body.routingNumber || null,
    status: 'pending',
    requestDate: new Date(),
    balance: body.balance || '$0.00',
    pin: body.pin || null,
    pinSetByUser: !!body.pinSetByUser,
    securityQuestions: Array.isArray(body.securityQuestions) ? body.securityQuestions : [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const r = await db.collection('pending_users').insertOne(doc);
  res.status(201).json({ id: r.insertedId });
}));

app.post('/api/pending-users/approve/:id', asyncH(async (req, res) => {
  const _id = new ObjectId(req.params.id);
  const pending = await db.collection('pending_users').findOne({ _id });
  if (!pending) return res.status(404).json({ error: 'Not found' });
  await db.collection('pending_users').deleteOne({ _id });
  const user = {
    name: pending.name, email: pending.email, phone: pending.phone,
    accountNumber: pending.accountNumber, routingNumber: pending.routingNumber,
    balance: Number((pending.balance||'0').toString().replace(/[$,]/g,'')) || 0,
    status: 'active', role: 'user', pin: pending.pin, pinSetByUser: !!pending.pinSetByUser,
    joinDate: new Date(), lastLogin: null, createdAt: new Date(), updatedAt: new Date()
  };
  const r = await db.collection('users').insertOne(user);
  res.json({ ok: true, id: r.insertedId });
}));

app.post('/api/pending-users/reject/:id', asyncH(async (req, res) => {
  const _id = new ObjectId(req.params.id);
  const { reason = '' } = req.body || {};
  const pending = await db.collection('pending_users').findOne({ _id });
  if (!pending) return res.status(404).json({ error: 'Not found' });
  await db.collection('pending_users').deleteOne({ _id });
  await db.collection('audit_logs').insertOne({ eventType: 'pending_user_rejected', pendingId: _id, email: pending.email, reason, timestamp: new Date() });
  res.json({ ok: true });
}));

// Transactions
app.get('/api/transactions/pending', asyncH(async (req, res) => {
  const rows = await db.collection('pending_transactions').find({}).sort({ createdAt: -1 }).toArray();
  res.json(rows);
}));

app.post('/api/transactions', asyncH(async (req, res) => {
  const tx = { ...req.body, status: 'pending', createdAt: new Date(), updatedAt: new Date() };
  const r = await db.collection('pending_transactions').insertOne(tx);
  res.status(201).json({ id: r.insertedId });
}));

app.post('/api/transactions/:id/approve', asyncH(async (req, res) => {
  const _id = new ObjectId(req.params.id);
  const tx = await db.collection('pending_transactions').findOne({ _id });
  if (!tx) return res.status(404).json({ error: 'Not found' });
  // Move to approved
  await db.collection('pending_transactions').deleteOne({ _id });
  const approved = { ...tx, status: 'approved', approvedAt: new Date(), updatedAt: new Date() };
  await db.collection('approved_transactions').insertOne(approved);
  // Update balance
  const user = await db.collection('users').findOne({ accountNumber: tx.accountNumber });
  if (user) {
    let bal = Number(user.balance || 0);
    const amt = Number(tx.amount || 0);
    if (tx.type === 'deposit') bal += amt; else if (tx.type === 'transfer' || tx.type==='billpay') bal -= amt;
    await db.collection('users').updateOne({ _id: user._id }, { $set: { balance: bal, updatedAt: new Date() } });
  }
  // Audit
  await db.collection('audit_logs').insertOne({ eventType: 'transaction_approved', txId: _id, accountNumber: tx.accountNumber, amount: tx.amount, type: tx.type, timestamp: new Date() });
  res.json({ ok: true });
}));

app.post('/api/transactions/:id/reject', asyncH(async (req, res) => {
  const _id = new ObjectId(req.params.id);
  const { reason = '' } = req.body || {};
  const tx = await db.collection('pending_transactions').findOne({ _id });
  if (!tx) return res.status(404).json({ error: 'Not found' });
  await db.collection('pending_transactions').deleteOne({ _id });
  await db.collection('audit_logs').insertOne({ eventType: 'transaction_declined', txId: _id, reason, accountNumber: tx.accountNumber, amount: tx.amount, type: tx.type, timestamp: new Date() });
  res.json({ ok: true });
}));

// Audit
app.get('/api/audit', asyncH(async (req, res) => {
  const rows = await db.collection('audit_logs').find({}).sort({ timestamp: -1 }).limit(500).toArray();
  res.json(rows);
}));

// Basic admin login (email+password) for demo; in production use proper auth
app.post('/api/admin/login', asyncH(async (req, res) => {
  const { email, password } = req.body || {};
  const admin = await db.collection('admins').findOne({ email });
  if (!admin || (admin.password && admin.password !== password)) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ ok: true, admin: { email: admin.email, name: admin.name || 'Admin' } });
}));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 4000;
connectMongo().then(() => {
  app.listen(PORT, () => console.log(`API listening on :${PORT}`));
}).catch((e) => {
  console.error('Failed to connect to MongoDB', e.message);
  process.exit(1);
});
