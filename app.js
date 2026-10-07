import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import feedRoutes from './routes/feedRoutes.js';
import profesorRoutes from './routes/profesorRoutes.js';
import transaccionRoutes from './routes/transaccionRoutes.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || true }));
app.use(express.json({ limit: '10kb' }));

app.use('/api/auth', authRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/profesores', profesorRoutes);
app.use('/api/transacciones', transaccionRoutes);

app.get('/', (req, res) => {
  res.json({
    mensaje: 'API StudySafe conectada',
    version_node: process.version
  });
});

app.use((req, res) => {
  res.status(404).json({ exito: false, mensaje: 'Ruta no encontrada' });
});

app.use(errorHandler);

export default app;
