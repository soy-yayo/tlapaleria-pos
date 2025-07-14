const express = require('express');
const router = express.Router();
const pool = require('../db');
const { isAuthenticated, authorizeRoles } = require('../middleware/authMiddleware');

// Obtener todos los proveedores
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM proveedores');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;