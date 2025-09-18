const express = require('express');
const router = express.Router();
const pool = require('../db');
const {isAuthenticated, authorizeRoles} = require('../middleware/authMiddleware');

async function calcularLineasYTotal(client, productosPayload) {
  const ids = productosPayload.map(p => p.id);
  if (ids.length === 0) return { lineas: [], total: 0 };

  const { rows: productos } = await client.query(
    `SELECT id, descripcion, precio_venta, cantidad_stock
     FROM productos WHERE id = ANY($1)`, [ids]
  );

  const byId = new Map(productos.map(p => [p.id, p]));
  const lineas = productosPayload.map(p => {
    const prod = byId.get(p.id);
    if (!prod) throw new Error(`Producto ${p.id} no existe`);
    const cantidad = Math.max(1, parseInt(p.cantidad || 1));
    const precio = Number(prod.precio_venta);
    const subtotal = precio * cantidad;
    return {
      producto_id: prod.id,
      descripcion: prod.descripcion,
      precio_unitario: precio,
      cantidad,
      subtotal
    };
  });

  const total = lineas.reduce((acc, l) => acc + l.subtotal, 0);
  return { lineas, total };
}

router.post('/', isAuthenticated, authorizeRoles('ventas', 'admin'), async (req, res) => {
  const { cliente, forma_pago, productos } = req.body;
  const usuarioId = req.user.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { lineas, total } = await calcularLineasYTotal(client, productos || []);

    const { rows } = await client.query(
      `INSERT INTO cotizaciones (cliente, forma_pago, total, usuario_id)
       VALUES ($1, $2, $3, $4) RETURNING id, fecha`,
      [cliente || null, forma_pago || null, total, usuarioId]
    );
    const cotizacionId = rows[0].id;

    const insertDetalleText =
      `INSERT INTO cotizaciones_detalle
       (cotizacion_id, producto_id, descripcion, precio_unitario, cantidad, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6)`;

    for (const l of lineas) {
      await client.query(insertDetalleText, [
        cotizacionId, l.producto_id, l.descripcion, l.precio_unitario, l.cantidad, l.subtotal
      ]);
    }

    await client.query('COMMIT');
    return res.json({ cotizacion_id: cotizacionId });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    return res.status(400).json({ error: e.message || 'Error al crear cotización' });
  } finally {
    client.release();
  }
});

// Listar cotizaciones
router.get('/', isAuthenticated, authorizeRoles('ventas', 'admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.fecha, c.cliente, c.forma_pago, c.total, c.estado,
              u.nombre AS vendedor
       FROM cotizaciones c
       JOIN usuarios u ON u.id = c.usuario_id
       ORDER BY c.fecha DESC
       LIMIT 200`
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar cotizaciones' });
  }
});

// Obtener detalle de una cotización
router.get('/:id', isAuthenticated, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const { rows: encabezadoRows } = await pool.query(
      `SELECT c.id, c.fecha, c.cliente, c.forma_pago, c.total, c.estado, u.nombre AS vendedor
       FROM cotizaciones c
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.id = $1`, [id]
    );
    if (encabezadoRows.length === 0) return res.status(404).json({ error: 'No encontrada' });

    const { rows: detalleRows } = await pool.query(
      `SELECT d.producto_id AS id, d.descripcion, d.precio_unitario, d.cantidad, d.subtotal,
              p.cantidad_stock
       FROM cotizaciones_detalle d
       JOIN productos p ON p.id = d.producto_id
       WHERE d.cotizacion_id = $1
       ORDER BY d.id`, [id]
    );

    res.json({ ...encabezadoRows[0], productos: detalleRows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener cotización' });
  }
});

// Actualizar
router.put('/:id', isAuthenticated, authorizeRoles('ventas', 'admin'), async (req, res) => {
  const id = parseInt(req.params.id);
  const { cliente, forma_pago, productos } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { lineas, total } = await calcularLineasYTotal(client, productos || []);

    await client.query(
      `UPDATE cotizaciones SET cliente=$1, forma_pago=$2, total=$3 WHERE id=$4`,
      [cliente || null, forma_pago || null, total, id]
    );

    await client.query(`DELETE FROM cotizaciones_detalle WHERE cotizacion_id = $1`, [id]);

    const insertDetalleText =
      `INSERT INTO cotizaciones_detalle
       (cotizacion_id, producto_id, descripcion, precio_unitario, cantidad, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6)`;

    for (const l of lineas) {
      await client.query(insertDetalleText, [
        id, l.producto_id, l.descripcion, l.precio_unitario, l.cantidad, l.subtotal
      ]);
    }

    await client.query('COMMIT');
    return res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    return res.status(400).json({ error: e.message || 'Error al actualizar cotización' });
  } finally {
    client.release();
  }
});

// Eliminar
router.delete('/:id', isAuthenticated, authorizeRoles('ventas', 'admin'), async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await pool.query(`DELETE FROM cotizaciones WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al eliminar cotización' });
  }
});

module.exports = router;