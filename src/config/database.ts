import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();
const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(
      `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@smc101lab.g4patsk.mongodb.net/?retryWrites=true&w=majority&appName=SMC101LAB`
    );
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

export default connectDB;
