// Middleware d'authentification (à compléter plus tard)
const auth = (req, res, next) => {
  // TODO: vérifier le token JWT
  next();
};

module.exports = auth;
