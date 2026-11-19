import axios from 'axios';
import { API_URL } from '../config';

// El access token vive SOLO en memoria (nunca en localStorage): así un script
// malicioso (XSS) no puede robarlo. El refresh token va en una cookie HttpOnly
// que el navegador envía solo (por eso withCredentials: true).
let accessToken = null;
let alFallarSesion = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (t) => { accessToken = t || null; };
export const onSesionExpirada = (fn) => { alFallarSesion = fn; };

const instance = axios.create({ baseURL: API_URL, withCredentials: true });

// Cliente "limpio" (sin interceptores) para refrescar sin entrar en bucle.
const limpio = axios.create({ baseURL: API_URL, withCredentials: true });

// Una sola petición de refresh a la vez: si 5 llamadas fallan con 401
// simultáneamente, todas esperan la misma promesa (la rotación invalida el token anterior).
let refrescando = null;
export const refrescarAccessToken = () => {
  if (!refrescando) {
    refrescando = limpio.post('/auth/refresh')
      .then(({ data }) => { setAccessToken(data.accessToken); return data; })
      .finally(() => { refrescando = null; });
  }
  return refrescando;
};

instance.interceptors.request.use((c) => {
  if (accessToken) c.headers.Authorization = `Bearer ${accessToken}`;
  return c;
});

const RUTAS_AUTH = ['/auth/login', '/auth/registro', '/auth/refresh', '/auth/logout'];

instance.interceptors.response.use((r) => r, async (error) => {
  const { config, response } = error;
  const esAuth = RUTAS_AUTH.some((r) => config?.url?.includes(r));
  // Solo reintentamos si el access token venció (o falta) y aún no se reintentó.
  if (response?.status === 401 && config && !config._reintento && !esAuth && accessToken) {
    config._reintento = true;
    try {
      await refrescarAccessToken();
      config.headers.Authorization = `Bearer ${accessToken}`;
      return instance(config);
    } catch {
      setAccessToken(null);
      if (alFallarSesion) alFallarSesion();
    }
  }
  return Promise.reject(error);
});

export default instance;
