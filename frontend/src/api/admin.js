import axios from './axios';

export const obtenerUsuarios = (params, signal) => axios.get('/admin/usuarios', { params, signal });
export const obtenerUsuario = (id) => axios.get(`/admin/usuarios/${id}`);
export const cambiarEstadoUsuario = (id, activo) => axios.patch(`/admin/usuarios/${id}/estado`, { activo });
export const recargarUsuario = (usuario, monto, descripcion) => axios.post('/admin/recargas', { usuario, monto, ...(descripcion ? { descripcion } : {}) });
export const crearProfesor = (p) => axios.post('/profesores', p);
export const eliminarProfesor = (id) => axios.delete(`/admin/profesores/${id}`);
export const obtenerResumen = () => axios.get('/admin/resumen');
export const obtenerRecargas = (params) => axios.get('/admin/recargas', { params });
export const obtenerMaterialesAdmin = (params, signal) => axios.get('/admin/materiales', { params, signal });
export const eliminarMaterialAdmin = (id) => axios.delete(`/admin/materiales/${id}`);
export const obtenerSolicitudes = (params) => axios.get('/admin/solicitudes', { params });
export const aprobarSolicitud = (id) => axios.post(`/admin/solicitudes/${id}/aprobar`);
export const rechazarSolicitud = (id) => axios.post(`/admin/solicitudes/${id}/rechazar`);
