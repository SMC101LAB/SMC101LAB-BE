import express, { Request, Response, NextFunction } from 'express';
import connectDB from './config/database';
import userRoutes from './routes/userRoutes';
import cors from 'cors';

const app = express();

// Middleware
app.use(express.json());

app.use(
  cors({
    origin: 'http://localhost:5173', // 특정 출처 허용
    credentials: true, // 인증 정보 허용
  })
);

// Routes
app.use('/auth', userRoutes);

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
