const express = require('express');
const router = express.Router();
const pool = require('../db');
const { isAuthenticated, authorizeRoles } = require('../middlewares/authMiddleware');

router.get(
  '/corte-caja',
  isAuthenticated,
  authorizeRoles('admin'),
  async (req, res) => {
    try {
      const { desde, hasta, usuario_id, forma_pago } = req.query;

      const params = [];
      const conditions = [];

      if (desde) {
        params.push(desde);
        conditions.push(`v.fecha >= $${params.length}`);
      }
      if (hasta) {
        params.push(hasta);
        conditions.push(`v.fecha <= $${params.length}::date + interval '1 day'`);
      }
      if (usuario_id) {
        params.push(usuario_id);
        conditions.push(`v.usuario_id = $${params.length}`);
      }
      if (forma_pago) {
        params.push(forma_pago);
        conditions.push(`v.forma_pago = $${params.length}`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT
          DATE(v.fecha) as fecha,
          v.forma_pago,
          u.nombre as usuario,
          COUNT(v.id) as cantidad_ventas,
          SUM(v.total) as total_ventas
        FROM ventas v
        JOIN usuarios u ON u.id = v.usuario_id
        ${where}
        GROUP BY DATE(v.fecha), v.forma_pago, u.nombre
        ORDER BY DATE(v.fecha) DESC;
      `;

      const { rows } = await pool.query(query, params);
      res.json(rows);
    } catch (err) {
      console.error('Error en /api/reportes/corte-caja:', err);
      res.status(500).json({ error: 'Error al generar reporte' });
    }
  }
);

module.exports = router;
