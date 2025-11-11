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
             p.precio_venta AS precio_venta,
             p.codigo_barras,
             pr.nombre AS nombre_proveedor,
             c.nombre AS nombre_categoria,
             p.imagen, p.activo, p.clave_sat
      FROM productos p
      JOIN proveedores pr ON p.proveedor_id = pr.id
      LEFT JOIN categorias c ON p.categoria_id = c.id
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
    codigo, descripcion, ubicacion,
    stock_maximo, cantidad_stock, proveedor_id, categoria_id, codigo_barras,
    precio_compra, precio_venta, clave_sat, stock_minimo
  } = req.body;

  if (codigo_barras) {
    const dup = await pool.query(
      'SELECT 1 FROM productos WHERE codigo_barras = $1',
      [codigo_barras]
    );
    if (dup.rowCount) return res.status(400).json({ error: 'El código de barras ya existe' });
  }

  // Normalizadores
  const toInt = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : d };
  const toNum = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d };

  const _stock_maximo = toInt(stock_maximo, 0);
  const _cantidad_stock = toInt(cantidad_stock, 0);
  const _precio_compra = toNum(precio_compra, 0);
  const _precio_venta = toNum(precio_venta, 0);
  const _stock_minimo = toInt(stock_minimo, 0);

  if (!codigo?.trim()) return res.status(400).json({ error: 'codigo es obligatorio' });
  if (!descripcion?.trim()) return res.status(400).json({ error: 'descripcion es obligatoria' });
  if (_precio_venta < 0) return res.status(400).json({ error: 'precio_venta no puede ser negativo' });

  try {
    const dup = await pool.query('SELECT 1 FROM productos WHERE codigo = $1', [codigo]);
    if (dup.rows.length) return res.status(409).json({ error: 'El producto ya existe' });

    const imagen = req.file ? `/uploads/${req.file.filename}` : null;
    const result = await pool.query(
      `INSERT INTO productos
       (codigo, descripcion, ubicacion, stock_maximo, cantidad_stock,
        precio_compra, proveedor_id, categoria_id, codigo_barras, imagen, clave_sat, stock_minimo, precio_venta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [codigo, descripcion, ubicacion, _stock_maximo, _cantidad_stock,
        _precio_compra, proveedor_id, categoria_id, codigo_barras, imagen, clave_sat, _stock_minimo, _precio_venta]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', isAuthenticated, authorizeRoles('admin'), upload.single('imagen'), async (req, res) => {
  const { id } = req.params;
  const {
    codigo, descripcion, ubicacion,
    stock_maximo, cantidad_stock, proveedor_id, categoria_id, codigo_barras,
    precio_compra, precio_venta, clave_sat, stock_minimo
  } = req.body;

  if (codigo_barras) {
    const dup = await pool.query(
      'SELECT 1 FROM productos WHERE codigo_barras = $1 AND id <> $2',
      [codigo_barras, id]
    );
    if (dup.rowCount) return res.status(400).json({ error: 'El código de barras ya existe' });
  }

  const toInt = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : d };
  const toNum = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d };

  const _stock_maximo = toInt(stock_maximo, 0);
  const _cantidad_stock = toInt(cantidad_stock, 0);
  const _precio_compra = toNum(precio_compra, 0);
  const _precio_venta = toNum(precio_venta, 0);
  const _stock_minimo = toInt(stock_minimo, 0);

  if (_precio_venta < 0) return res.status(400).json({ error: 'precio_venta no puede ser negativo' });

  try {
    const check = await pool.query('SELECT id FROM productos WHERE id = $1', [id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Producto no encontrado' });

    const dup = await pool.query('SELECT id FROM productos WHERE codigo = $1 AND id <> $2', [codigo, id]);
    if (dup.rows.length) return res.status(409).json({ error: 'El código ya está registrado en otro producto' });

    const nuevaImagen = req.file ? `/uploads/${req.file.filename}` : null;
    const result = await pool.query(
      `UPDATE productos
       SET codigo=$1, descripcion=$2, ubicacion=$3, stock_maximo=$4, cantidad_stock=$5,
           proveedor_id=$6, categoria_id=$7, precio_compra=$8, codigo_barras=$9, stock_minimo=$10,
           imagen = COALESCE($11, imagen),
           clave_sat = COALESCE($12, clave_sat),
           precio_venta = COALESCE($13, precio_venta)
       WHERE id=$14
       RETURNING *`,
      [codigo, descripcion, ubicacion, _stock_maximo, _cantidad_stock,
        proveedor_id, categoria_id, _precio_compra, codigo_barras, _stock_minimo,
        nuevaImagen, clave_sat, _precio_venta, id]
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
