import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// ENDPOINT 1: REGISTRO CON VERIFICACIÓN KYC Y BLIND IDENTITY
export const registrarUsuario = async (req, res) => {
  try {
    const { alias, nombre_real, documento_identidad, email_institucional, password, avatar } = req.body;

    // 1. Validar que el correo sea institucional de la Universidad Autónoma del Cauca
    if (!email_institucional.endsWith('@uniautonoma.edu.co')) {
      return res.status(400).json({ 
        mensaje: 'Registro denegado: Se requiere un correo institucional @uniautonoma.edu.co' 
      });
    }

    // 2. Verificar si el alias, documento o correo ya existen en la base de datos
    const usuarioExistente = await User.findOne({
      $or: [{ alias }, { documento_identidad }, { email_institucional }]
    });

    if (usuarioExistente) {
      return res.status(400).json({ 
        mensaje: 'El alias, documento de identidad o correo ya se encuentra registrado' 
      });
    }

    // 3. Encriptar contraseña con Bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHashed = await bcrypt.hash(password, salt);

    // 4. Crear el usuario e inicializar Billetera en $0 COP
    const nuevoUsuario = new User({
      alias,
      nombre_real,
      documento_identidad,
      email_institucional,
      password: passwordHashed,
      avatar: avatar || 'default.png',
      billetera: { saldo: 0, moneda: 'COP' }
    });

    await nuevoUsuario.save();

    res.status(201).json({
      exito: true,
      mensaje: 'Usuario registrado exitosamente en StudySafe',
      perfil_publico: {
        id: nuevoUsuario._id,
        alias: nuevoUsuario.alias,
        avatar: nuevoUsuario.avatar,
        saldo: nuevoUsuario.billetera.saldo
      }
    });

  } catch (error) {
    res.status(500).json({ 
      mensaje: 'Error al registrar el usuario', 
      error: error.message 
    });
  }
};

// ENDPOINT 2: LOGIN Y GENERACIÓN DE JWT
export const iniciarSesion = async (req, res) => {
  try {
    const { email_institucional, password } = req.body;

    const usuario = await User.findOne({ email_institucional }).select('+password');
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Credenciales inválidas' });
    }

    const passwordCorrecto = await bcrypt.compare(password, usuario.password);
    if (!passwordCorrecto) {
      return res.status(400).json({ mensaje: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: usuario._id, alias: usuario.alias },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.status(200).json({
      exito: true,
      token,
      usuario: {
        id: usuario._id,
        alias: usuario.alias,
        avatar: usuario.avatar,
        saldo: usuario.billetera.saldo,
        nivel: usuario.nivel_reputacion.nivel
      }
    });

  } catch (error) {
    res.status(500).json({ mensaje: 'Error en el servidor al iniciar sesión', error: error.message });
  }
};