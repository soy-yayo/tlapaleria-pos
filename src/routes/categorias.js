const express = require('express');
const router = express.Router();
const pool = require('../db');
const { isAuthenticated, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/', async (_req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, nombre, activo FROM categorias WHERE activo = TRUE ORDER BY nombre ASC'
    );
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, nombre, activo FROM categorias WHERE id = $1',
      [req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', isAuthenticated, authorizeRoles('admin'), async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre requerido' });
  try {
    const dup = await pool.query('SELECT 1 FROM categorias WHERE lower(nombre)=lower($1)', [nombre]);
    if (dup.rows.length) return res.status(400).json({ error: 'La categoría ya existe' });
    const r = await pool.query(
      'INSERT INTO categorias (nombre) VALUES ($1) RETURNING *',
      [nombre]
    );
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', isAuthenticated, authorizeRoles('admin'), async (req, res) => {
  const { nombre, activo } = req.body;
  try {
    const r = await pool.query(
      'UPDATE categorias SET nombre = COALESCE($1, nombre), activo = COALESCE($2, activo) WHERE id = $3 RETURNING *',
      [nombre, activo, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', isAuthenticated, authorizeRoles('admin'), async (req, res) => {
  try {
    const r = await pool.query(
      'UPDATE categorias SET activo = FALSE WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ message: 'Categoría eliminada' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
