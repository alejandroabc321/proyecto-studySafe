import express from 'express';
import cors from 'cors';
import conectarBD from './config/db.js';
import authRoutes from './routes/authRoutes.js';

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());

// Conectar a MongoDB
conectarBD();

// Rutas de la API
app.use('/api/auth', authRoutes);

// Ruta de estado
app.get('/', (req, res) => {
  res.json({
    mensaje: 'API StudySafe conectada a MongoDB',
    version_node: process.version
  });
});

// Arrancar Servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
