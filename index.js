import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';


dotenv.config();

const PORT = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.AUTH_MONGODB_URL);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const connectedClient = await connectToMongoDB();
const db = connectedClient.db('assignment-8');
const eventsCollection = db.collection('events');
const usereventsCollection = db.collection('userevents');


// --- JWT (assignment challenge: protected APIs) ---------------------------
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'sevaconnect-dev-secret';

// Express middleware: lets the request through only with a valid Bearer JWT.
function verifyJWT(req, res, next) {
  const header = req.headers?.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'unauthorized: token missing' });
  }
  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
    if (!payload?.email) {
      return res.status(403).json({ error: 'forbidden: token identity missing' });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(403).json({ error: 'forbidden: invalid token' });
  }
}


// Issues a signed JWT for a logged-in user's email (client stores it and
// sends it as `Authorization: Bearer <token>` on protected calls).
app.post('/jwt', (req, res) => {
  const email = req.body?.email;
  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }
  const token = jwt.sign({ email }, ACCESS_TOKEN_SECRET, { expiresIn: '7d' });
  res.send({ token });
});


app.post('/create-event', verifyJWT, async (req, res) => {
  const event = {
    ...req.body,
    organizerEmail: req.user.email,
  };
  const result = await eventsCollection.insertOne(event);
  res.send(result);
});

app.get('/events', verifyJWT, async (req, res) => {
  const query = { organizerEmail: req.user.email };
  const events = await eventsCollection.find(query).toArray();
  res.send(events);
});

app.delete('/events/:id', verifyJWT, async (req, res) => {
  const id = req.params.id;
  const result = await eventsCollection.deleteOne({
    _id: new ObjectId(id),
    organizerEmail: req.user.email,
  });
  res.send(result);
});

app.put('/events/:id', verifyJWT, async (req, res) => {
  const id = req.params.id;
  const { _id, ...updatedEvent } = req.body;
  delete updatedEvent.organizerEmail;
  const result = await eventsCollection.updateOne(
    { _id: new ObjectId(id), organizerEmail: req.user.email },
    { $set: updatedEvent },
  );
  res.send(result);
});

app.get('/all-events', async (req, res) => {
  const events = await eventsCollection.find({}).toArray();
  res.send(events);
});

// 6 soonest upcoming events (MongoDB sort + .limit(6)) for the homepage.
app.get('/recent-events', async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const events = await eventsCollection
    .find({ date: { $gte: today } })
    .sort({ date: 1, time: 1 })
    .limit(6)
    .toArray();
  res.send(events);
});

app.get('/event/:id', async (req, res) => {
  const id = req.params.id;
  const event = await eventsCollection.findOne({ _id: new ObjectId(id) });
  res.send(event);
});

await usereventsCollection.createIndex({ eventId: 1, userEmail: 1 }, { unique: true });

app.get('/events/:id/join', async (req, res) => {
  const id = req.params.id;
  const email = req.query.email;
  const eventId = new ObjectId(id);
  const joined = await usereventsCollection.findOne({ eventId, userEmail: email });
  const joinedCount = await usereventsCollection.countDocuments({ eventId });
  res.send({ joined: !!joined, joinedCount });
});

app.post('/events/:id/join', verifyJWT, async (req, res) => {
  const id = req.params.id;
  const email = req.user.email;
  const eventId = new ObjectId(id);

  // One user = one join: reject duplicates before touching the counters.
  const existing = await usereventsCollection.findOne({ eventId, userEmail: email });
  if (existing) {
    return res.status(409).json({ error: 'already-joined' });
  }

  await usereventsCollection.insertOne({ eventId, userEmail: email, joinedAt: new Date() });
  await eventsCollection.updateOne({ _id: eventId }, { $inc: { volunteersNeeded: -1 } });

  res.send({ success: true });
});

app.delete('/events/:id/join', verifyJWT, async (req, res) => {
  const id = req.params.id;
  const email = req.user.email;
  const eventId = new ObjectId(id);

  const result = await usereventsCollection.deleteOne({ eventId, userEmail: email });

  // Only give the spot back if a join actually existed.
  if (result.deletedCount > 0) {
    await eventsCollection.updateOne({ _id: eventId }, { $inc: { volunteersNeeded: 1 } });
  }

  res.send(result);
});

app.get('/user-events', verifyJWT, async (req, res) => {
  const email = req.user.email;
  const events = await usereventsCollection.aggregate([
    { $match: { userEmail: email } },
    { $sort: { joinedAt: -1 } },
    { $lookup: { from: 'events', localField: 'eventId', foreignField: '_id', as: 'event' } },
    { $unwind: '$event' },
    { $replaceRoot: { newRoot: { $mergeObjects: ['$event', { joinedAt: '$joinedAt' }] } } }
  ]).toArray();
  res.send(events);
});

app.post('/user-events', verifyJWT, async (req, res) => {
  const userEvent = {
    ...req.body,
    userEmail: req.user.email,
  };
  const result = await usereventsCollection.insertOne(userEvent);
  res.send(result);
});


app.get('/', (req, res) => {
  res.send('Hello, World!');
});



app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
