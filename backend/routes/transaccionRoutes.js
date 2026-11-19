import { Router } from 'express';
import { obtenerHistorial, comprarMaterial, misCompras, solicitarRecarga, misSolicitudes } from '../controllers/transaccionController.js';
import { verificarToken } from '../middlewares/auth.js';
import { validar, validarId } from '../middlewares/validar.js';
import { validarSolicitudRecarga } from '../validators/index.js';

const router = Router();

router.use(verificarToken); // Todas las rutas requieren autenticación

router.get('/historial', obtenerHistorial);
router.get('/compras', misCompras);
router.get('/solicitudes', misSolicitudes);
router.post('/solicitudes', validar(validarSolicitudRecarga), solicitarRecarga);
router.post('/comprar/:materialId', validarId('materialId'), comprarMaterial);

export default router;
