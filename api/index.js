// Función de Vercel: atiende todas las rutas /api/* (ver vercel.json).
const { handle } = require('../lib/app');

module.exports = (req, res) => handle(req, res);
