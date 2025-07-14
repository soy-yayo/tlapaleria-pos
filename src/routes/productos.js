const express = require('express');
const router = express.Router();
const pool = require('../db');
const { isAuthenticated, authorizeRoles } = require('../middleware/authMiddleware');

// Obtener todos los productos
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM productos');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear producto (solo admin_local)
router.post('/', isAuthenticated, authorizeRoles('admin_local'), async (req, res) => {
  const {
    codigo,
    descripcion,
    ubicacion,
    stock_maximo,
    cantidad_stock,
    proveedor_id,
    precio_compra,
    precio_venta
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO productos (codigo, descripcion, ubicacion, stock_maximo, cantidad_stock, proveedor_id, precio_compra, precio_venta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [codigo, descripcion, ubicacion, stock_maximo, cantidad_stock, proveedor_id, precio_compra, precio_venta]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar producto (solo admin_local, si no tiene stock)
router.put('/:id', isAuthenticated, authorizeRoles('admin_local'), async (req, res) => {
  const { id } = req.params;
  const {
    codigo,
    descripcion,
    ubicacion,
    stock_maximo,
    proveedor,
    precio_compra,
    precio_venta
  } = req.body;

  try {
    // Verificar si el producto tiene stock
    const check = await pool.query('SELECT cantidad_stock FROM productos WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });

    if (check.rows[0].cantidad_stock > 0) {
      return res.status(400).json({ error: 'No se puede editar productos con stock mayor a 0' });
    }

    const result = await pool.query(
      `UPDATE productos 
       SET codigo = $1, descripcion = $2, ubicacion = $3, stock_maximo = $4,
           proveedor = $5, precio_compra = $6, precio_venta = $7
       WHERE id = $8 RETURNING *`,
      [codigo, descripcion, ubicacion, stock_maximo, proveedor, precio_compra, precio_venta, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar producto (solo admin_local, si no tiene stock)
router.delete('/:id', isAuthenticated, authorizeRoles('admin_local'), async (req, res) => {
  const { id } = req.params;

  try {
    const check = await pool.query('SELECT cantidad_stock FROM productos WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });

    if (check.rows[0].cantidad_stock > 0) {
      return res.status(400).json({ error: 'No se puede eliminar productos con stock mayor a 0' });
    }

    await pool.query('DELETE FROM productos WHERE id = $1', [id]);
    res.json({ message: 'Producto eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;