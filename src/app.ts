import express, { Request, Response, NextFunction } from 'express';
import connectDB from './config/database';
import userRoutes from './routes/userRoutes';

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use('/auth/users', userRoutes);

app.get('/', (req: Request, res: Response, next: NextFunction) => {
  res.send('Hello TypeScript');
});

// Connect to MongoDB
connectDB().then(() => {
  app.listen('3000', () => {
    console.log('Listening on Port ::: ' + 3000);
  });
});

export default app;
