import { Router } from 'express';
import { obtenerProfesores, crearProfesor } from '../controllers/profesorController.js';
import { verificarToken } from '../middlewares/auth.js';
import { validar } from '../middlewares/validar.js';
import { validarProfesor } from '../validators/index.js';

const router = Router();

router.get('/', obtenerProfesores);
router.post('/', verificarToken, validar(validarProfesor), crearProfesor);

export default router;
