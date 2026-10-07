import { Router } from 'express';
import {
  publicarMaterial, obtenerFeed, obtenerMaterial,
  actualizarMaterial, eliminarMaterial, obtenerArchivo
} from '../controllers/feedController.js';
import { verificarToken } from '../middlewares/auth.js';
import { validar, validarId } from '../middlewares/validar.js';
import { validarMaterial } from '../validators/index.js';

const router = Router();

router.get('/', obtenerFeed);
router.post('/publicar', verificarToken, validar(validarMaterial), publicarMaterial);
router.get('/:id', validarId(), obtenerMaterial);
router.get('/:id/archivo', verificarToken, validarId(), obtenerArchivo);
router.put('/:id', verificarToken, validarId(), validar(validarMaterial, { parcial: true }), actualizarMaterial);
router.delete('/:id', verificarToken, validarId(), eliminarMaterial);

export default router;
