import { Router } from 'express';
import { registrarUsuario, iniciarSesion, refrescarToken, cerrarSesion, perfil } from '../controllers/authController.js';
import { verificarToken } from '../middlewares/auth.js';
import { verificarOrigen, limitarLogin, limitarRegistro } from '../middlewares/seguridad.js';
import { validar } from '../middlewares/validar.js';
import { validarRegistro, validarLogin } from '../validators/index.js';

const router = Router();

router.post('/registro', limitarRegistro, validar(validarRegistro), registrarUsuario);
router.post('/login', validar(validarLogin), limitarLogin, iniciarSesion);
router.post('/refresh', verificarOrigen, refrescarToken);   // usa la cookie HttpOnly
router.post('/logout', verificarOrigen, cerrarSesion);      // revoca la sesión
router.get('/yo', verificarToken, perfil);

export default router;
