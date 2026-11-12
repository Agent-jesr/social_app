import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import cors from 'cors';
import socialRoutes from './routes/socialRoutes.js';
import imagelRoutes from './routes/imageRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/api', socialRoutes);
app.use('/api', imagelRoutes);


app.listen(PORT, () => {
  console.log(`🔥 Server is running on http://localhost:${PORT}`);
});