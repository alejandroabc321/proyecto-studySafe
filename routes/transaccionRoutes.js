import { Router } from 'express';
import { obtenerHistorial, recargarSaldo, comprarMaterial } from '../controllers/transaccionController.js';
import { verificarToken } from '../middlewares/auth.js';
import { validar, validarId } from '../middlewares/validar.js';
import { validarRecarga } from '../validators/index.js';

const router = Router();

router.use(verificarToken); // Todas las rutas requieren autenticación

router.get('/historial', obtenerHistorial);
router.post('/recargar', validar(validarRecarga), recargarSaldo);
router.post('/comprar/:materialId', validarId('materialId'), comprarMaterial);

export default router;
