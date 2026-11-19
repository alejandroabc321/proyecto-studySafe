# StudySafe Frontend (Vite + React + CSS básico)

1. `npm install`  2. `copy .env.example .env`  3. `npm run dev` → http://localhost:5173

**Backend** (puerto 5000): en su `.env` debe tener `ACCESS_SECRET`, `REFRESH_SECRET` (distintos) y `FRONTEND_URL=http://localhost:5173`; después `npm install` (nuevas dependencias: helmet, cookie-parser, express-rate-limit).

## Estructura (guía del profesor)
```
src/
├─ api/         axios.js (instancia + refresh) · auth.js · admin.js · materiales.js · transacciones.js
├─ components/  Header · MaterialCard · MaterialForm (reutilizable) · PreviewCarousel · AdminNav · ui/
├─ context/     AuthContext.jsx
├─ hooks/       useDebounce.js
├─ pages/       Home · Login · Registro · DetalleMaterial · CrearMaterial · EditarMaterial
│               MisMateriales · MisCompras · Billetera · admin/ (Resumen, Solicitudes, Usuarios, Detalle, Recargas, Materiales, Profesores)
├─ schemas/     validaciones con zod (mismas reglas que el backend)
├─ styles/      global.css · forms.css
└─ routes.jsx   ProtectedRoute
```

## Autenticación (guía "Modern MERN Authentication")
- **Access token (15 min): solo en memoria**, nunca en localStorage → un XSS no puede robarlo.
- **Refresh token (7 días): cookie HttpOnly** que gestiona el navegador (`withCredentials: true`).
- Al abrir o recargar la app, `AuthContext` pide un access nuevo a `POST /auth/refresh`; mientras tanto se muestra "Restaurando tu sesión…" y las rutas protegidas esperan (`loading`).
- Si una petición recibe 401, el interceptor refresca **una sola vez** (aunque fallen varias a la vez) y reintenta; si el refresh falla, se cierra la sesión.
- Salir llama a `POST /auth/logout`, que revoca la sesión en el servidor.

## Administrador
- Con rol `admin` al iniciar sesión entra directo a `/admin`:
  - **Resumen**: usuarios, materiales, compras, dinero vendido, saldo en circulación, total recargado y últimas recargas.
  - **Solicitudes**: bandeja de recargas que piden los estudiantes (con contador de pendientes); el admin aprueba (se recarga el monto) o rechaza.
  - **Usuarios** (`/admin/usuarios`): búsqueda/filtro, detalle de cada uno (compras, publicaciones, movimientos), recarga y activar/desactivar.
  - **Recargas**: buscas al usuario, recargas y ves el historial global (quién recargó a quién).
  - **Materiales**: todos los materiales de la plataforma, con búsqueda y botón Retirar.
  - **Profesores**: agregar y eliminar. `AdminRoute` redirige a quien no sea admin; el backend lo vuelve a comprobar en cada petición.
- Los usuarios ya no se recargan solos: la billetera permite **Solicitar recarga** (monto + nota) y muestra el estado de cada solicitud; el saldo solo cambia cuando el admin aprueba (puedes poner un contacto en `VITE_CONTACTO_ADMIN`).

## Subir materiales
- Al vender: archivo (PDF, Word, PowerPoint, Excel o ZIP, 20 MB) y/o enlace, más 1–2 imágenes de previsualización (JPG/PNG/WEBP, 3 MB). Se valida en el navegador y otra vez en el servidor.
- El detalle muestra un **carrusel** (botones, puntos y flechas del teclado). Antes de comprar solo se ven las imágenes; el archivo se descarga con la sesión (`Descargar`) y el enlace aparece solo tras comprar.

## Cumplimiento de las guías

**Guía CRUD (React + Vite + CSS + Axios)**

| La guía pide | En StudySafe |
|---|---|
| `components/` Header, ProyectoForm, ProyectoCard | `Header.jsx`, `MaterialForm.jsx` (reutilizable), `MaterialCard.jsx` (+ `PreviewCarousel`, `AdminNav`, `ui/`) |
| `pages/` Home, Proyectos, CrearProyecto, EditarProyecto | `Home.jsx` (catálogo público), `MisMateriales.jsx` (lista propia con editar/eliminar), `CrearMaterial.jsx`, `EditarMaterial.jsx` (+ Login, Registro, DetalleMaterial, MisCompras, Billetera, `admin/`) |
| `api/proyectos.js` con Axios (obtener, crear, actualizar, eliminar, por id) | `api/materiales.js` (mismo CRUD) + `auth.js`, `transacciones.js`, `admin.js`; instancia única en `axios.js` |
| `styles/global.css` y `forms.css` | Igual: `global.css` (base, layout, componentes) y `forms.css` (formularios) |
| `App.jsx` y `main.jsx` | Igual (`App.jsx` define las rutas; `main.jsx` monta Router y `AuthProvider`) |
| CRUD completo | Crear (`CrearMaterial`), Leer (`Home`, `DetalleMaterial`), Actualizar (`EditarMaterial`), Eliminar (`DetalleMaterial`, solo el autor) |

**Guía "Arquitectura de Autenticación Moderna"**

| La guía pide | En StudySafe |
|---|---|
| Access token de 5-15 min, solo en memoria | JWT de 15 min en una variable de `api/axios.js` (nunca localStorage) |
| Refresh token largo en cookie HttpOnly + Secure + SameSite=Strict, guardado en MongoDB | Cookie HttpOnly/SameSite=Strict (Secure en producción); en la colección `sesiones` solo se guarda su **hash** |
| Rotación y detección de reutilización | Cada `/refresh` emite uno nuevo; reutilizar uno viejo revoca toda la sesión |
| Interceptor de Axios: ante 401 refresca y reintenta | `api/axios.js` (un solo refresh aunque fallen varias peticiones a la vez) |
| `AuthProvider` con `checkAuth()` al iniciar vía `/refresh` | `context/AuthContext.jsx` |
| `ProtectedRoute` con `isAuthenticated` → `<Navigate>` / `<Outlet>` | `routes.jsx` (+ `AdminRoute` por rol) |
| Logout real en 3 fases (React, cookie, MongoDB) | `logout()` borra el token en memoria; `POST /auth/logout` limpia la cookie y borra la sesión |
| Secretos fuertes y separados | `ACCESS_SECRET` y `REFRESH_SECRET` distintos y de 32+ caracteres (el servidor no arranca si son iguales) |
| bcrypt para contraseñas | `bcryptjs` en registro y login |
