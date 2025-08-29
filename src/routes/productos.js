const express = require('express');
const router = express.Router();
const pool = require('../db');
const { isAuthenticated, authorizeRoles } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

// Obtener todos los productos
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`SELECT productos.*, proveedores.nombre AS nombre_proveedor
FROM productos
JOIN proveedores ON productos.proveedor_id = proveedores.id
WHERE productos.activo = TRUE;
`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener producto por ID
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

// Crear producto (solo admin_local)
router.post('/', isAuthenticated, authorizeRoles('admin'), upload.single('imagen'), async (req, res) => {
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
    // const serverUrl = "http://localhost:3000";
    const imagen = req.file ? `/uploads/${req.file.filename}` : null;

    const producto_existente = await pool.query('SELECT * FROM productos WHERE codigo = $1', [codigo]);

    if (producto_existente.rows.length > 0) {
      return res.status(400).json({ error: 'El producto ya existe' });
    }

    const result = await pool.query(
      `INSERT INTO productos (codigo, descripcion, ubicacion, stock_maximo, cantidad_stock,  precio_compra, precio_venta, proveedor_id, imagen)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [codigo, descripcion, ubicacion, stock_maximo, cantidad_stock, precio_compra, precio_venta, proveedor_id, imagen]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar producto (solo admin_local, si no tiene stock)
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
    precio_venta
  } = req.body;

  try {
    const check = await pool.query('SELECT cantidad_stock FROM productos WHERE id = $1', [id]);
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
       SET codigo = $1, descripcion = $2, ubicacion = $3, stock_maximo = $4, cantidad_stock = $5,
           proveedor_id = $6, precio_compra = $7, precio_venta = $8,
           imagen = COALESCE($9, imagen)
       WHERE id = $10 RETURNING *`,
      [codigo, descripcion, ubicacion, stock_maximo, cantidad_stock, proveedor_id, precio_compra, precio_venta, nuevaImagen, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Eliminar producto (solo admin_local, si no tiene stock)
router.delete('/:id', isAuthenticated, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const check = await pool.query('SELECT cantidad_stock FROM productos WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });

    // if (check.rows[0].cantidad_stock > 0) {
    //   return res.status(400).json({ error: 'No se puede eliminar productos con stock mayor a 0' });
    // }

    await pool.query('DELETE FROM productos WHERE id = $1', [id]);
    // await pool.query('UPDATE productos SET activo = false WHERE id = $1', [id]);
    res.json({ message: 'Producto eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;