import { Router } from 'express';
import { registrarUsuario, iniciarSesion } from '../controllers/authController.js';
import { validar } from '../middlewares/validar.js';
import { validarRegistro, validarLogin } from '../validators/index.js';

const router = Router();

router.post('/registro', validar(validarRegistro), registrarUsuario);
router.post('/login', validar(validarLogin), iniciarSesion);

export default router;
