const bcrypt = require('bcrypt');

const contraseñaPlana = '123654'; // Cambia según la contraseña real
bcrypt.hash(contraseñaPlana, 15).then(hash => {
  console.log('Contraseña encriptada:', hash);
});
