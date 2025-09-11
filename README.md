# POS Tlapalería — Backend

Backend del sistema de **Punto de Venta** para una tlapalería, construido con **Node.js (Express)** y **PostgreSQL**.

---

## ✨ Características

- API REST con Express.
- Autenticación **JWT** + middlewares de roles (`admin`, `ventas`, `inventario`).
- CRUD de **productos**, **proveedores**, **usuarios**.
- **Ventas** transaccionales con `BEGIN/COMMIT/ROLLBACK` y bloqueos `FOR UPDATE`.
- **Reportes**: historial y corte de caja.
- **Precios automáticos** calculados en PostgreSQL mediante `rangos_utilidad` + triggers.
- Subida de imágenes con **multer**, expuestas en `/uploads`.

---

## 🛠️ Requisitos

- Node.js >= 18
- PostgreSQL >= 13
- PM2 (para despliegue en VPS)

---

## ⚙️ Variables de entorno (`.env`)

```env
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/tlapaleria_db

JWT_SECRET=un_secreto_fuerte
```

## ▶️ Scripts
Instalar dependencias:

```bash
npm install
```
Correr en desarrollo:
```bash
npm run dev
```
Producción con PM2:
```bash
pm2 start ecosystem.config.js
```
Logs:
```bash
pm2 logs tlapaleria-backend --lines 100
```

## 🗄️ Migraciones principales (SQL)
Ubicadas en **db/migrations/**:

**rangos_reset.sql** — crea tabla rangos_utilidad, función **calc_precio_venta** y **triggers** en productos.

**add_clave_sat.sql** — agrega campo **clave_sat** a productos.

Aplicar en VPS:

```bash
sudo -u postgres psql -d tlapaleria_db -f db/migrations/rangos_reset.sql
```
🔑 Endpoints principales
Autenticación

**POST /api/auth/login** → devuelve token JWT.

### Productos

**GET /api/productos**

**POST /api/productos** (admin)

**PUT /api/productos/:id** (admin)

**DELETE /api/productos/:id** (admin)

### Ventas

**POST /api/ventas** (ventas/admin) — guarda venta y detalle.

**GET /api/venta**s (admin) — listado con nombre del vendedor.

**GET /api/ventas/:id** (admin) — detalle de venta.

### Rangos de utilidad

**GET /api/rangos** (admin)

**POST /api/rangos** (admin)

**PUT /api/rangos/:id** (admin)

**DELETE /api/rangos/:id** (admin)

## 📂 Estructura de carpetas
```bash
backend/
 ├─ src/
 │   ├─ routes/       # rutas Express (productos, ventas, auth, rangos)
 │   ├─ middleware/   # middlewares de auth y upload
 │   ├─ db.js         # conexión a PostgreSQL (pg Pool)
 │   └─ index.js      # punto de entrada Express
 ├─ db/migrations/    # scripts SQL
 ├─ ecosystem.config.js
 ├─ package.json
 └─ README.md
 ```

## 🛡️ Seguridad
- JWT.