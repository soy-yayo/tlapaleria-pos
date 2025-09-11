const express = require('express');
const router = express.Router();
const pool = require('../db');
const { isAuthenticated, authorizeRoles } = require('../middleware/authMiddleware');

// Obtener ventas con detalles básicos
router.get('/ventas', isAuthenticated, async (req, res) => {
  const result = await pool.query(`
    SELECT v.id, v.fecha, v.total, v.forma_pago, u.usuario, u.nombre as nombre_vendedor
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


router.post('/ventas', isAuthenticated, authorizeRoles('admin', 'ventas'), async (req, res) => {

  const client = await pool.connect();
  try {
    const { forma_pago, productos } = req.body;

    if (!forma_pago || !Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({ error: 'Datos de venta inválidos' });
    }
    const qtyById = new Map();
    for (const item of productos) {
      const pid = Number(item.id);
      const qty = Number(item.cantidad);
      if (!pid || !qty || qty <= 0) {
        return res.status(400).json({ error: 'Datos de productos inválidos' });
      }
      qtyById.set(pid, (qtyById.get(pid) || 0) + qty);
    }

    const productIds = Array.from(qtyById.keys()).sort((a, b) => a - b);

    await client.query('BEGIN');

    // Bloqueamos productos involucrados en la venta
    const { rows: prodRows } = await client.query(
      `
        SELECT id, descripcion, cantidad_stock, precio_venta, activo
        FROM productos
        WHERE id = ANY($1)
        FOR UPDATE
        `,
      [productIds]
    );

    if (prodRows.length !== productIds.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Algunos productos no están disponibles' });
    }

    //Validamos estado y stock
    for (const p of prodRows) {
      if (!p.activo) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `Producto inactivo: ${p.id} - ${p.descripcion}`,
        });
      }
      const requested = qtyById.get(p.id);
      if (requested > p.cantidad_stock) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `Stock insuficiente en ${p.descripcion} (disp: ${p.cantidad_stock}, solicitado: ${requested})`,
        });
      }
    }

    //Calculamos total con precios actuales
    let total = 0;
    for (const p of prodRows) {
      const qty = qtyById.get(p.id);
      total += qty * p.precio_venta;
    }

    // Inserta la venta (usuario desde JWT)
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        await client.query('ROLLBACK');
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const insertVenta = `
        INSERT INTO ventas (fecha, total, forma_pago, usuario_id)
        VALUES (NOW(), $1, $2, $3)
        RETURNING id
      `;
      const { rows: ventaRows } = await client.query(insertVenta, [
        total,
        forma_pago,
        usuarioId,
      ]);
      const ventaId = ventaRows[0].id;

      // Inserta detalle y descuenta stock
      for (const p of prodRows) {
        const qty = qtyById.get(p.id);

        // detalle_venta
        await client.query(
          `
          INSERT INTO detalle_venta (venta_id, producto_id, cantidad, precio_unitario)
          VALUES ($1, $2, $3, $4)
          `,
          [ventaId, p.id, qty, p.precio_venta]
        );

        // productos: descuenta stock
        await client.query(
          `
          UPDATE productos
          SET cantidad_stock = cantidad_stock - $1
          WHERE id = $2
          `,
          [qty, p.id]
        );
      }

      await client.query('COMMIT');
      return res.status(201).json({
        ok: true,
        venta_id: ventaId,
        total,
        forma_pago,
        items: prodRows.map((p) => ({
          producto_id: p.id,
          descripcion: p.descripcion,
          cantidad: qtyById.get(p.id),
          precio_unitario: p.precio_venta,
          subtotal: Number(p.precio_venta) * qtyById.get(p.id),
        })),
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error en /api/ventas:', err);
      return res.status(500).json({ error: 'Error al procesar la venta' });
    } finally {
      client.release();
    }
  }
);

module.exports = router;