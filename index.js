import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';


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


app.post('/create-event', async (req, res) => {
  const event = req.body;
  const result = await eventsCollection.insertOne(event);
  res.send(result);
});

app.get('/events', async (req, res) => {
  const email = req.query.email;
  const query = email ? { organizerEmail: email } : {};
  const events = await eventsCollection.find(query).toArray();
  res.send(events);
});

app.delete('/events/:id', async (req, res) => {
  const id = req.params.id;
  const result = await eventsCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});

app.put('/events/:id', async (req, res) => {
  const id = req.params.id;
  const { _id, ...updatedEvent } = req.body;
  const result = await eventsCollection.updateOne({ _id: new ObjectId(id) }, { $set: updatedEvent });
  res.send(result);
});

app.get('/all-events', async (req, res) => {
  const events = await eventsCollection.find({}).toArray();
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

app.post('/events/:id/join', async (req, res) => {
  const id = req.params.id;
  const email = req.query.email;
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

app.delete('/events/:id/join', async (req, res) => {
  const id = req.params.id;
  const email = req.query.email;
  const eventId = new ObjectId(id);

  const result = await usereventsCollection.deleteOne({ eventId, userEmail: email });

  // Only give the spot back if a join actually existed.
  if (result.deletedCount > 0) {
    await eventsCollection.updateOne({ _id: eventId }, { $inc: { volunteersNeeded: 1 } });
  }

  res.send(result);
});

app.get('/user-events', async (req, res) => {
  const email = req.query.email;
  const events = await usereventsCollection.aggregate([
    { $match: { userEmail: email } },
    { $sort: { joinedAt: -1 } },
    { $lookup: { from: 'events', localField: 'eventId', foreignField: '_id', as: 'event' } },
    { $unwind: '$event' },
    { $replaceRoot: { newRoot: { $mergeObjects: ['$event', { joinedAt: '$joinedAt' }] } } }
  ]).toArray();
  res.send(events);
});

app.post('/user-events', async (req, res) => {
  const userEvent = req.body;
  const result = await usereventsCollection.insertOne(userEvent);
  res.send(result);
});


app.get('/', (req, res) => {
  res.send('Hello, World!');
});



app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
