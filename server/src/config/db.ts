import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

export async function connectDb(uri = env.MONGODB_URI) {
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    logger.info('MongoDB connected');
  } catch (err: any) {
    logger.error('MongoDB connection failed', { message: err.message });
    throw err;
  }
}
export const disconnectDb = () => mongoose.disconnect();
