import axios from './axios';

// Recargar saldo ya no lo hace el usuario: lo registra el administrador (api/admin.js).
export const comprarMaterial = (materialId) => axios.post(`/transacciones/comprar/${materialId}`);
export const obtenerHistorial = () => axios.get('/transacciones/historial');
export const obtenerMisCompras = () => axios.get('/transacciones/compras');
export const solicitarRecarga = (monto, nota) => axios.post('/transacciones/solicitudes', { monto, nota });
export const obtenerMisSolicitudes = () => axios.get('/transacciones/solicitudes');
