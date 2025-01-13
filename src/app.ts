import express, { Request, Response, NextFunction } from 'express';

const app = express();

app.get('/', (req: Request, res: Response, next: NextFunction) => {
  res.send('Hello TypeScript');
});

app.listen('3000', () => {
  console.log('Listening on Port ::: ' + 3000);
});

export default app;
