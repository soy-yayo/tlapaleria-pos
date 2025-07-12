const express = require('express');
const cors = require('cors');
const pool = require('./src/db');
const productosRoutes = require('./src/routes/productos');
const authRoutes = require('./src/routes/auth');

const app = express();
app.use(express.json());
app.use(cors());

app.use('/api/productos', productosRoutes);
app.use('/api', authRoutes);

app.get('/', (req, res) => res.send('API funcionando'));

app.get('/productos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM productos');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
