import axios from './axios';

// `signal` permite cancelar la petición anterior cuando el usuario sigue escribiendo.
export const obtenerMateriales = (params, signal) => axios.get('/feed', { params, signal });
export const obtenerMaterial = (id) => axios.get(`/feed/${id}`);
export const obtenerMisMateriales = () => axios.get('/feed/mios');
// `datos` es un FormData (texto + documento + imágenes de previsualización); axios pone el multipart solo.
export const crearMaterial = (datos) => axios.post('/feed/publicar', datos);
export const actualizarMaterial = (id, datos) => axios.put(`/feed/${id}`, datos);
export const eliminarMaterial = (id) => axios.delete(`/feed/${id}`);
export const obtenerArchivo = (id) => axios.get(`/feed/${id}/archivo`);
// El archivo subido exige sesión, por eso se baja como blob con el token (no con un <a href> directo).
export const descargarArchivo = (id) => axios.get(`/feed/${id}/descargar`, { responseType: 'blob' });
export const obtenerProfesores = () => axios.get('/profesores');
