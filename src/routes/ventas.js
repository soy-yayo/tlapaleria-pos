const express = require('express');
const router = express.Router();
const pool = require('../db');
const { isAuthenticated } = require('../middleware/authMiddleware');

// Obtener ventas con detalles básicos
router.get('/ventas', isAuthenticated, async (req, res) => {
  const result = await pool.query(`
    SELECT v.id, v.fecha, v.total, v.forma_pago, u.usuario
    FROM ventas v
    JOIN usuarios u ON u.id = v.usuario_id
    ORDER BY v.fecha DESC
  `);
  res.json(result.rows);
});

router.get('/ventas/:id', isAuthenticated, async (req, res) => {
  const ventaId = req.params.id;

  const productos = await pool.query(`
    SELECT p.descripcion, dv.cantidad, dv.precio_unitario
    FROM detalle_venta dv
    JOIN productos p ON p.id = dv.producto_id
    WHERE dv.venta_id = $1
  `, [ventaId]);

  res.json(productos.rows);
});


router.post('/ventas', async (req, res) => {
  const { forma_pago, productos, usuario_id } = req.body;

  const total = productos.reduce((acc, p) => acc + (p.precio_venta * p.cantidad), 0);

  const venta = await pool.query(
    'INSERT INTO ventas (fecha, total, forma_pago, usuario_id) VALUES (CURRENT_DATE, $1, $2, $3) RETURNING id',
    [total, forma_pago, usuario_id]
  );

  const ventaId = venta.rows[0].id;

  for (const producto of productos) {
    await pool.query(
      'INSERT INTO detalle_venta (venta_id, producto_id, cantidad, precio_unitario) VALUES ($1, $2, $3, $4)',
      [ventaId, producto.id, producto.cantidad, producto.precio_venta]
    );

    const stockResult = await pool.query(
      'SELECT cantidad_stock FROM productos WHERE id = $1',
      [producto.id]
    );

    if (stockResult.rows[0].cantidad_stock < producto.cantidad) {
      return res.status(400).json({
        error: `Stock insuficiente para "${producto.descripcion || producto.codigo}"`
      });
    }
    
        // Opcional: actualizar stock
    await pool.query(
      'UPDATE productos SET cantidad_stock = cantidad_stock - $1 WHERE id = $2',
      [producto.cantidad, producto.id]
    );
  }

  res.status(201).json({ ventaId });
});

module.exports = router;