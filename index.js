import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
const PORT = process.env.PORT || 5000;

const app = express();
dotenv.config();



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

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello, World!');
});



app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});