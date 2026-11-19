export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Las rutas de previsualización llegan del backend como "/feed/<id>/preview/<n>" (relativas a la API).
export const urlApi = (ruta) => `${API_URL}${ruta}`;

// Límites de subida (iguales a los del backend).
export const MAX_DOC_MB = 20;
export const MAX_IMG_MB = 3;
export const MAX_PREVIEWS = 2;
