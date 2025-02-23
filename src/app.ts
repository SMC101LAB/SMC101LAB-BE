import express, { Request, Response, NextFunction } from 'express';
import connectDB from './config/database';
import userRoutes from './routes/userRoutes';
import slopeRoutes from './routes/slopeRoutes';
import cors from 'cors';
import path from 'path';
const app = express();

// Middleware
app.use(express.json());

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'https://smc101lab.netlify.app',
      'http://smc101lab.s3-website.ap-northeast-2.amazonaws.com',
      'https://smc101lab.com/',
    ],
    credentials: true,
  })
);

// Routes
app.use('/auth', userRoutes);
app.use('/slopes', slopeRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.get('/', (req: Request, res: Response, next: NextFunction) => {
  res.send('Hello TypeScript');
});

// Connect to MongoDB
connectDB().then(() => {
  app.listen(3000, '0.0.0.0', () => {
    console.log('Listening on Port ::: ' + 3000);
  });
});

export default app;
