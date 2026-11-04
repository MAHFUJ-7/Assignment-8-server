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
  const query = email ? {organizerEmail: email} : {};
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
  const {_id,...updatedEvent} = req.body;
  const result = await eventsCollection.updateOne({ _id: new ObjectId(id) }, { $set: updatedEvent });
  res.send(result);
});

app.get('/all-events', async (req, res) => {
  const events = await eventsCollection.find({}).toArray();
  res.send(events);
});

app.get('/event/:id', async (req, res) =>{
  const id=req.params.id;
  const event = await eventsCollection.findOne({_id: new ObjectId(id)});
  res.send(event);
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
