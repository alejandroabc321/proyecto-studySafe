import './config/env.js';
import app from './app.js';
import conectarBD from './config/db.js';

// Conectar a MongoDB
conectarBD();

// Arrancar el servidor HTTP
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
