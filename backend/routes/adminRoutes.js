import { Router } from 'express';
import { listarUsuarios, detalleUsuario, cambiarEstado, recargarUsuario, eliminarProfesor,
  resumen, listarRecargas, listarSolicitudes, aprobarSolicitud, rechazarSolicitud, listarMateriales, eliminarMaterialAdmin } from '../controllers/adminController.js';
import { verificarToken, soloAdmin } from '../middlewares/auth.js';
import { validar, validarId } from '../middlewares/validar.js';
import { validarEstadoUsuario, validarRecargaAdmin } from '../validators/index.js';

const router = Router();

router.use(verificarToken, soloAdmin); // todo lo de /api/admin es exclusivo del administrador

router.get('/resumen', resumen);
router.get('/usuarios', listarUsuarios);
router.get('/usuarios/:id', validarId(), detalleUsuario);
router.patch('/usuarios/:id/estado', validarId(), validar(validarEstadoUsuario), cambiarEstado);
router.delete('/profesores/:id', validarId(), eliminarProfesor);
router.get('/recargas', listarRecargas);
router.post('/recargas', validar(validarRecargaAdmin), recargarUsuario);
router.get('/solicitudes', listarSolicitudes);
router.post('/solicitudes/:id/aprobar', validarId(), aprobarSolicitud);
router.post('/solicitudes/:id/rechazar', validarId(), rechazarSolicitud);
router.get('/materiales', listarMateriales);
router.delete('/materiales/:id', validarId(), eliminarMaterialAdmin);

export default router;
