const express = require('express');
const router = express.Router();
const pool = require('../db');
const { isAuthenticated, authorizeRoles } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.codigo, p.descripcion, p.ubicacion, p.stock_maximo, p.cantidad_stock,
             p.precio_compra, p.stock_minimo,
             GREATEST(p.stock_maximo - p.cantidad_stock, 0) AS stock_faltante,
             COALESCE(p.precio_venta, calc_precio_venta(p.precio_compra)) AS precio_venta,
             pr.nombre AS nombre_proveedor,
             p.imagen, p.activo, p.clave_sat
      FROM productos p
      JOIN proveedores pr ON p.proveedor_id = pr.id
      WHERE p.activo = TRUE
      ORDER BY p.descripcion ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM productos WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', isAuthenticated, authorizeRoles('admin'), upload.single('imagen'), async (req, res) => {
  const {
    codigo,
    descripcion,
    ubicacion,
    stock_maximo,
    cantidad_stock,
    proveedor_id,
    precio_compra,
    clave_sat,
    stock_minimo
  } = req.body;

  try {
    const imagen = req.file ? `/uploads/${req.file.filename}` : null;
    const producto_existente = await pool.query('SELECT 1 FROM productos WHERE codigo = $1', [codigo]);
    if (producto_existente.rows.length > 0) {
      return res.status(400).json({ error: 'El producto ya existe' });
    }
    const result = await pool.query(
      `INSERT INTO productos (codigo, descripcion, ubicacion, stock_maximo, cantidad_stock, precio_compra, proveedor_id, imagen, clave_sat, stock_minimo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [codigo, descripcion, ubicacion, stock_maximo, cantidad_stock, precio_compra, proveedor_id, imagen, clave_sat, stock_minimo]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', isAuthenticated, authorizeRoles('admin'), upload.single('imagen'), async (req, res) => {
  const { id } = req.params;
  const {
    codigo,
    descripcion,
    ubicacion,
    stock_maximo,
    cantidad_stock,
    proveedor_id,
    precio_compra,
    clave_sat,
    stock_minimo
  } = req.body;

  try {
    const check = await pool.query('SELECT id FROM productos WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });

    const codigoExistente = await pool.query(
      'SELECT id FROM productos WHERE codigo = $1 AND id <> $2',
      [codigo, id]
    );
    if (codigoExistente.rows.length > 0) {
      return res.status(400).json({ error: 'El código ya está registrado en otro producto' });
    }

    const nuevaImagen = req.file ? `/uploads/${req.file.filename}` : null;
    const result = await pool.query(
      `UPDATE productos
       SET codigo=$1, descripcion=$2, ubicacion=$3, stock_maximo=$4, cantidad_stock=$5,
           proveedor_id=$6, precio_compra=$7, stock_minimo=$8,
           imagen = COALESCE($9, imagen),
           clave_sat = COALESCE($10, clave_sat)
       WHERE id=$11
       RETURNING *`,
      [codigo, descripcion, ubicacion, stock_maximo, cantidad_stock, proveedor_id, precio_compra, stock_minimo, nuevaImagen, clave_sat, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', isAuthenticated, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const check = await pool.query('SELECT cantidad_stock FROM productos WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });

    await pool.query('UPDATE productos SET activo = false WHERE id = $1', [id]);
    res.json({ message: 'Producto eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
