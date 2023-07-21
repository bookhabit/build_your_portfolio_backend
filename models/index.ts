import mongoose from 'mongoose'

export default async function connectToMongoDB() {
    try {
      if (process.env.MONGO_URL) {
        await mongoose.connect(process.env.MONGO_URL);
        console.log('Successfully connected to MongoDB');
      }
    } catch (error) {
      console.error(error);
    }
  }

