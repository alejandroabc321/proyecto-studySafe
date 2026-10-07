# StudySafe Backend

API REST (Node.js + Express + MongoDB/Mongoose) para compartir y vender material académico entre estudiantes.
Arquitectura en capas: `routes/` (enrutamiento) → `controllers/` (lógica) → `models/` (persistencia),
con `middlewares/` (auth, validación, errores) y `validators/` (validación de entradas).

## Puesta en marcha
1. `npm install`
2. Copia `.env.example` a `.env` y completa `MONGO_URI` y `JWT_SECRET` (secreto largo y aleatorio).
3. `npm run dev` (o `npm start`).

## Pruebas
- **Automáticas:** `npm test` (usa una BD separada `studysafe_test`, que se borra sola; nunca toca tus datos reales).
- **Demostración con el servidor encendido:** `.\scripts\demo.ps1` en PowerShell.
- **Validadores de MongoDB:** `npm run validadores` (modo advertencia) y `npm run validadores:estricto`.

## Endpoints
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | /api/auth/registro | Público | Registro con correo institucional |
| POST | /api/auth/login | Público | Devuelve JWT |
| GET | /api/feed | Público | Lista paginada (`?materia=&tipo=&pagina=&limite=`), sin enlace de archivo |
| GET | /api/feed/:id | Público | Detalle de un material |
| POST | /api/feed/publicar | Token | Publicar material |
| PUT | /api/feed/:id | Autor | Editar material |
| DELETE | /api/feed/:id | Autor | Eliminar material |
| GET | /api/feed/:id/archivo | Token | Enlace del archivo (gratis, propio o comprado) |
| GET / POST | /api/profesores | Público / Token | Listar / crear profesores |
| POST | /api/transacciones/recargar | Token | Recarga de saldo (solo desarrollo) |
| POST | /api/transacciones/comprar/:materialId | Token | Compra con débito atómico |
| GET | /api/transacciones/historial | Token | Movimientos del usuario |
