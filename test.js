const bcrypt = require('bcrypt');

const contraseñaPlana = 'admin321'; // Cambia según la contraseña real
bcrypt.hash(contraseñaPlana, 10).then(hash => {
  console.log('Contraseña encriptada:', hash);
});
