const express = require('express');
const pool = require('../db');
const { isAuthenticated, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

function buildNumRange(min, max) {
  return { text: "numrange($1, $2, '[]')", values: [min, max] };
}
// GET todos
router.get('/', isAuthenticated, authorizeRoles('admin'), async (req, res) => {
  const { rows } = await pool.query(`
    SELECT id,
           lower(rango) AS min,
           CASE WHEN upper_inf(rango) THEN NULL ELSE upper(rango) END AS max,
           porcentaje
    FROM rangos_utilidad
    ORDER BY lower(rango) ASC
  `);

  res.json(rows.map(r => ({
    id: r.id,
    min: Number(r.min),
    max: r.max === null ? 'Infinity' : Number(r.max),
    porcentaje: Number(r.porcentaje)
  })));
});


// POST nuevo rango
router.post('/', isAuthenticated, authorizeRoles('admin'), async (req, res) => {
  try {
    const { min, max, porcentaje } = req.body;
    const parsedMin = Number(min);
    const parsedMax = (max === 'Infinity' || max === null) ? null : Number(max);
    const parsedPct = Number(porcentaje);

    const rangeSql = buildNumRange(parsedMin, parsedMax);
    const { rows } = await pool.query(
      `INSERT INTO rangos_utilidad(rango, porcentaje)
       VALUES(${rangeSql.text}, $3) RETURNING id,
              lower(rango) AS min,
              CASE WHEN upper_inf(rango) THEN NULL ELSE upper(rango) END AS max,
              porcentaje`,
      [...rangeSql.values, parsedPct]
    );

    const r = rows[0];
    res.json({
      id: r.id,
      min: Number(r.min),
      max: r.max === null ? 'Infinity' : Number(r.max),
      porcentaje: Number(r.porcentaje)
    });
  } catch (e) {
    if (String(e.message).includes('rangos_no_solapados')) {
      return res.status(409).json({ message: 'El rango se solapa con otro existente' });
    }
    console.error(e);
    res.status(500).json({ message: 'Error al guardar el rango' });
  }
});

// PUT editar rango
router.put('/:id', isAuthenticated, authorizeRoles('admin'), async (req, res) => {
  try {
    const { min, max, porcentaje } = req.body;
    const parsedMin = Number(min);
    const parsedMax = (max === 'Infinity' || max === null) ? null : Number(max);
    const parsedPct = Number(porcentaje);

    const rangeSql = buildNumRange(parsedMin, parsedMax);
    const { rows } = await pool.query(
      `UPDATE rangos_utilidad
         SET rango = ${rangeSql.text}, porcentaje = $3
       WHERE id = $4
       RETURNING id,
                 lower(rango) AS min,
                 CASE WHEN upper_inf(rango) THEN NULL ELSE upper(rango) END AS max,
                 porcentaje`,
      [...rangeSql.values, parsedPct, req.params.id]
    );

    const r = rows[0];
    res.json({
      id: r.id,
      min: Number(r.min),
      max: r.max === null ? 'Infinity' : Number(r.max),
      porcentaje: Number(r.porcentaje)
    });
  } catch (e) {
    if (String(e.message).includes('rangos_no_solapados')) {
      return res.status(409).json({ message: 'El rango se solapa con otro existente' });
    }
    console.error(e);
    res.status(500).json({ message: 'Error al actualizar el rango' });
  }
});


// DELETE
router.delete('/:id', isAuthenticated, authorizeRoles('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM rangos_utilidad WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error al eliminar el rango' });
  }
});


module.exports = router;
