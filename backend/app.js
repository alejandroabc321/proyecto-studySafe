import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import adminRoutes from './routes/adminRoutes.js';
import authRoutes from './routes/authRoutes.js';
import feedRoutes from './routes/feedRoutes.js';
import profesorRoutes from './routes/profesorRoutes.js';
import transaccionRoutes from './routes/transaccionRoutes.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { origenPermitido } from './middlewares/seguridad.js';

const app = express();

app.use(helmet());
// credentials: true permite que el navegador envíe la cookie del refresh token (solo desde el frontend).
app.use(cors({ origin: origenPermitido(), credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
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
