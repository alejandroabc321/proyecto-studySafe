# StudySafe Backend

API REST (Node.js + Express + MongoDB/Mongoose) para compartir y vender material académico entre estudiantes.
Arquitectura en capas: `routes/` (enrutamiento) → `controllers/` (lógica) → `models/` (persistencia),
con `middlewares/` (auth, validación, errores) y `validators/` (validación de entradas).

## Puesta en marcha
1. `npm install`
2. Copia `.env.example` a `.env` y completa `MONGO_URI`, `ACCESS_SECRET` y `REFRESH_SECRET` (dos secretos **distintos**, largos y aleatorios) y `FRONTEND_URL=http://localhost:5173`.
3. **Crea el administrador:** `npm run crear-admin` (pide correo, alias, nombre, documento y contraseña por consola; la contraseña no se muestra ni queda en el código). Si el correo ya existe, ofrece convertir ese usuario en admin (debe cerrar sesión y volver a entrar).
4. `npm run dev` (o `npm start`).

## Autenticación (access + refresh token)
- **Access token:** JWT de 15 minutos firmado con `ACCESS_SECRET`; se envía como `Authorization: Bearer`. El frontend lo guarda solo en memoria.
- **Refresh token:** JWT de 7 días firmado con `REFRESH_SECRET`, en cookie `HttpOnly` + `SameSite=Strict` (+ `Secure` en producción) limitada a `/api/auth`. En MongoDB (colección `sesiones`) solo se guarda su hash.
- **Rotación:** cada `/refresh` emite un refresh token nuevo. Reutilizar uno ya rotado (fuera de una tolerancia de 10 s para pestañas paralelas) revoca la sesión completa.
- **Límites:** una sesión dura como máximo 30 días, cada usuario conserva sus 5 sesiones más recientes, y un usuario desactivado pierde sus sesiones al intentar renovar.
- **Protecciones:** `helmet`, CORS solo para `FRONTEND_URL` con credenciales, verificación de `Origin` en refresh/logout y límite de intentos en login (10 cada 15 min por IP+correo) y registro (20 por hora por IP).
- En producción con HTTPS detrás de un proxy, configura `app.set('trust proxy', 1)` para que el límite de intentos vea la IP real.

## Administrador
- El registro público **siempre** crea estudiantes (el campo `rol` se ignora). Solo `npm run crear-admin` crea administradores.
- Todo `/api/admin/*` y la creación de profesores usan `soloAdmin`, que consulta el rol **en la base de datos** en cada petición: un admin desactivado o al que se le quita el rol pierde el acceso de inmediato, aunque su token siga vigente.
- **Recargas:** los usuarios ya no pueden recargarse (se eliminó `POST /transacciones/recargar`). Las hace el admin con `POST /api/admin/recargas` y cada recarga guarda quién la registró (`realizadaPor`). El usuario puede **solicitar** una recarga indicando el monto (`POST /api/transacciones/solicitudes`); la solicitud queda pendiente hasta que el admin la aprueba (se hace la recarga) o la rechaza.
- **Supervisión:** lista/búsqueda de usuarios, detalle con compras, publicaciones y movimientos, y activar/desactivar cuentas (al desactivar se cierran sus sesiones; no se puede desactivar a otro admin ni a uno mismo). El detalle nunca expone contraseña ni documento.
- **Profesores:** los estudiantes los registran al publicar (si escriben uno nuevo se guarda solo, con facultad "Por definir") y el admin puede completarlos o eliminarlos (`DELETE /api/admin/profesores/:id`); un índice único (sin distinguir mayúsculas ni tildes) evita duplicados. Si ya tienes profesores repetidos en la colección, MongoDB no podrá crear ese índice hasta que los limpies.

## Archivos subidos y previsualizaciones
- `POST /api/feed/publicar` y `PUT /api/feed/:id` aceptan JSON (solo enlace, como antes) o `multipart/form-data` con los campos del material más `archivo` (1 documento) y `previews` (hasta 2 imágenes). Hace falta al menos un archivo o un enlace.
- **Se guardan en disco** (`uploads/archivos` y `uploads/previews`, o `UPLOADS_DIR`), **no en MongoDB**; en la base solo queda el nombre generado y los metadatos. `uploads/` está en `.gitignore`.
- **Seguridad:** el nombre en disco lo genera el servidor (uuid); el tipo se decide por los primeros bytes del archivo (no por la extensión ni el `Content-Type`); documentos permitidos: pdf, doc, docx, ppt, pptx, xls, xlsx, zip (máx. 20 MB); imágenes: jpg, png, webp (máx. 3 MB; no se permite SVG). Todo se valida **antes** de escribir en disco.
- **Acceso:** las previsualizaciones son públicas (`GET /api/feed/:id/preview/:n`). El archivo solo se entrega a quien lo compró, al autor o si es gratis (`GET /api/feed/:id/descargar`); nunca se sirve como carpeta estática. El enlace tampoco aparece en el feed ni en el detalle.
- Al editar con archivos nuevos, los anteriores se borran del disco; al eliminar el material se borran todos sus archivos.
- Opcionales en `.env`: `UPLOADS_DIR`, `ARCHIVO_MAX_MB`, `PREVIEW_MAX_MB`.

## Pruebas
- **Automáticas:** `npm test` (usa una BD separada `studysafe_test`, que se borra sola; nunca toca tus datos reales).
- **Demostración con el servidor encendido:** `.\scripts\demo.ps1` en PowerShell.
- **Validadores de MongoDB:** `npm run validadores` (modo advertencia) y `npm run validadores:estricto`.

## Endpoints
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | /api/auth/registro | Público | Registro con correo institucional (solo `@uniautonoma.edu.co`) |
| POST | /api/auth/login | Público | Devuelve el *access token* (15 min) y deja el *refresh token* en una cookie HttpOnly |
| POST | /api/auth/refresh | Cookie | Renueva el access token y **rota** el refresh token (si se reutiliza uno viejo, se revoca la sesión) |
| POST | /api/auth/logout | Cookie | Cierra la sesión: borra la sesión en MongoDB y la cookie |
| GET | /api/feed | Público | Lista paginada (`?q=&materia=&tipo=&orden=&pagina=&limite=`; `q` busca por título, materia y profesor sin distinguir tildes; `orden`: recientes, precio_asc, precio_desc), sin enlace de archivo |
| GET | /api/feed/:id | Público | Detalle de un material |
| POST | /api/feed/publicar | Token | Publicar material (JSON con enlace, o multipart con archivo + previsualizaciones) |
| PUT | /api/feed/:id | Autor | Editar material |
| DELETE | /api/feed/:id | Autor | Eliminar material |
| GET | /api/feed/:id/archivo | Token | Cómo obtener el material: enlace y/o datos del archivo (gratis, propio o comprado) |
| GET | /api/feed/:id/descargar | Token | Descarga del archivo subido (gratis, propio o comprado) |
| GET | /api/feed/:id/preview/:n | Público | Imagen de previsualización (0 o 1) |
| GET / POST | /api/profesores | Público / Token | Listar / crear profesores |
| DELETE | /api/admin/profesores/:id | Admin | Eliminar un profesor |
| POST | /api/transacciones/comprar/:materialId | Token | Compra con débito atómico |
| GET | /api/transacciones/historial | Token | Movimientos del usuario |
| GET | /api/transacciones/compras | Token | Materiales comprados por el usuario |
| GET | /api/feed/mios | Token | Materiales publicados por el usuario |
| GET | /api/auth/yo | Token | Datos y saldo del usuario autenticado |
| GET | /api/admin/usuarios | Admin | Lista y busca usuarios (`?q=&rol=&pagina=`) |
| GET | /api/admin/usuarios/:id | Admin | Detalle: compras, publicaciones y movimientos |
| PATCH | /api/admin/usuarios/:id/estado | Admin | Activar / desactivar cuenta (`{ activo }`) |
| POST | /api/admin/recargas | Admin | Recargar saldo a un usuario (`{ usuario, monto, descripcion? }`) |
| GET | /api/admin/recargas | Admin | Historial de todas las recargas (quién recibió y qué admin la registró) |
| GET | /api/transacciones/solicitudes | Usuario | Mis solicitudes de recarga |
| POST | /api/transacciones/solicitudes | Usuario | Solicitar una recarga (`{ monto, nota? }`); no mueve saldo, máx. 3 pendientes |
| GET | /api/admin/solicitudes | Admin | Solicitudes (`?estado=pendiente\|aprobada\|rechazada`) |
| POST | /api/admin/solicitudes/:id/aprobar | Admin | Aprueba: recarga el monto pedido (una sola vez) |
| POST | /api/admin/solicitudes/:id/rechazar | Admin | Rechaza sin mover saldo |
| GET | /api/admin/resumen | Admin | Cifras globales: usuarios, materiales, compras, dinero vendido, saldo en circulación, total recargado |
| GET | /api/admin/materiales | Admin | Todos los materiales (`?q=&pagina=`) para supervisar |
| DELETE | /api/admin/materiales/:id | Admin | Retirar un material (borra también sus archivos) |
