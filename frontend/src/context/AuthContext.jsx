import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { loginRequest, logoutRequest, profileRequest, registerRequest } from '../api/auth';
import { onSesionExpirada, refrescarAccessToken, setAccessToken } from '../api/axios';
import { msg } from '../utils';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true mientras se restaura la sesión
  const [errors, setErrors] = useState([]);

  const limpiarSesion = useCallback(() => { setAccessToken(null); setUser(null); }, []);

  // checkAuth() (como en la guía): al abrir la app no hay token en memoria, así que se pide uno nuevo
  // a POST /auth/refresh con la cookie HttpOnly. Si la cookie sirve, el usuario sigue dentro tras un F5.
  const checkAuth = useCallback(async () => {
    try { const data = await refrescarAccessToken(); setUser(data.usuario); }
    catch { limpiarSesion(); }
    finally { setLoading(false); }
  }, [limpiarSesion]);

  useEffect(() => {
    onSesionExpirada(limpiarSesion);
    checkAuth();
  }, [checkAuth, limpiarSesion]);

  const signin = async (datos) => {
    setErrors([]);
    try {
      const { data } = await loginRequest(datos);
      setAccessToken(data.accessToken);
      setUser(data.usuario);
      return true;
    } catch (e) { setErrors([msg(e)]); return false; }
  };

  const signup = async (datos) => {
    setErrors([]);
    try { await registerRequest(datos); return true; }
    catch (e) { setErrors([msg(e)]); return false; }
  };

  const logout = async () => {
    try { await logoutRequest(); } catch { /* aunque falle la red, se cierra localmente */ }
    limpiarSesion();
  };

  const setSaldo = (saldo) => setUser((u) => (u ? { ...u, billetera: { ...u.billetera, saldo } } : u));

  // Saldo "en tiempo real": se consulta cada 10 s mientras haya sesión.
  useEffect(() => {
    if (!user) return undefined;
    const id = setInterval(async () => {
      try { const { data } = await profileRequest(); setUser(data.usuario); } catch { /* el interceptor maneja la sesión */ }
    }, 10000);
    return () => clearInterval(id);
  }, [!!user]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={{ user, loading, errors, isAuthenticated: !!user, checkAuth, signin, signup, logout, setSaldo }}>
      {children}
    </AuthContext.Provider>
  );
}
