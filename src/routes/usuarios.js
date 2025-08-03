const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const { isAuthenticated, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/', isAuthenticated, authorizeRoles('admin'), async (req, res) => {
  try {
    const usuarios = await pool.query('SELECT * FROM usuarios');
    res.json(usuarios.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', isAuthenticated, authorizeRoles('admin'), async (req, res) => {
  const { nombre, usuario, contraseña, rol } = req.body;

  if (!nombre || !usuario || !contraseña || !rol) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  try {
    const existente = await pool.query('SELECT * FROM usuarios WHERE usuario = $1', [usuario]);
    if (existente.rows.length > 0) {
      return res.status(400).json({ error: 'Este nombre de usuario ya está en uso' });
    }

    const hashed = await bcrypt.hash(contraseña, 10);

    await pool.query(
      'INSERT INTO usuarios (nombre, usuario, contraseña, rol) VALUES ($1, $2, $3, $4)',
      [nombre, usuario, hashed, rol]
    );

    res.status(201).json({ message: 'Usuario registrado correctamente' });
  } catch (err) {
    console.error('Error al registrar usuario:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/:id', isAuthenticated, authorizeRoles('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
