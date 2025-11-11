const express = require('express');
const router = express.Router();
const pool = require('../db');
const { isAuthenticated, authorizeRoles } = require('../middleware/authMiddleware');

router.post('/entradas', isAuthenticated, authorizeRoles('admin'), async (req, res) => {
  const { entradas } = req.body || {};
  if (!Array.isArray(entradas) || entradas.length === 0) {
    return res.status(400).json({ error: 'Nada que actualizar' });
  }

  try {
    await pool.query('BEGIN');

    // Opcional: devolver filas actualizadas
    const updated = [];

    for (const { id, cantidad } of entradas) {
      const cant = Number(cantidad);
      const pid = Number(id);
      if (!Number.isFinite(cant) || cant <= 0 || !Number.isFinite(pid)) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ error: 'Datos inválidos en entradas' });
      }

      const r = await pool.query(
        `UPDATE productos
           SET cantidad_stock = GREATEST(cantidad_stock + $2, 0)
         WHERE id = $1 AND activo = TRUE
         RETURNING id, descripcion, cantidad_stock`,
        [pid, cant]
      );
      if (r.rowCount === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ error: `Producto ${pid} no encontrado o inactivo` });
      }
      updated.push(r.rows[0]);
    }

    await pool.query('COMMIT');
    res.json({ updated: updated.length, items: updated });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
