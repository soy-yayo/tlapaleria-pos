const express = require('express');
const router = express.Router();
const pool = require('../db');
const { isAuthenticated, authorizeRoles } = require('../middleware/authMiddleware');

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