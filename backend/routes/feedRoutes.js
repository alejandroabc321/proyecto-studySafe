import { Router } from 'express';
import {
  publicarMaterial, obtenerFeed, obtenerMaterial,
  actualizarMaterial, eliminarMaterial, obtenerArchivo, descargarArchivo, obtenerPreview, misMateriales
} from '../controllers/feedController.js';
import { verificarToken } from '../middlewares/auth.js';
import { recibirMaterial } from '../middlewares/subidas.js';
import { validar, validarId } from '../middlewares/validar.js';
import { validarMaterial } from '../validators/index.js';

const router = Router();

router.get('/', obtenerFeed);
router.get('/mios', verificarToken, misMateriales); // antes de '/:id'
router.post('/publicar', verificarToken, recibirMaterial, validar(validarMaterial), publicarMaterial);
router.get('/:id', validarId(), obtenerMaterial);
router.get('/:id/archivo', verificarToken, validarId(), obtenerArchivo);
router.get('/:id/descargar', verificarToken, validarId(), descargarArchivo);
router.get('/:id/preview/:n', validarId(), obtenerPreview);
router.put('/:id', verificarToken, validarId(), recibirMaterial, validar(validarMaterial, { parcial: true }), actualizarMaterial);
router.delete('/:id', verificarToken, validarId(), eliminarMaterial);

export default router;
