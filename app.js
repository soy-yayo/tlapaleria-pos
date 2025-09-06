const express = require('express');
const cors = require('cors');
const pool = require('./src/db');
const productosRoutes = require('./src/routes/productos');
const authRoutes = require('./src/routes/auth');
const proveedoresRoutes = require('./src/routes/proveedores');
const ventasRoutes = require('./src/routes/ventas');
const userRouter = require('./src/routes/usuarios');
const reportesRoute = require('./src/routes/reportes');
const rangosRoutes = require('./src/routes/rangos');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json()); 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/productos', productosRoutes);
app.use('/api', authRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api', ventasRoutes);
app.use('/api/usuarios', userRouter);
app.use('/api/reportes', reportesRoute);
app.use('/api/rangos', rangosRoutes);

app.get('/', (req, res) => res.send('API funcionando'));

const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
