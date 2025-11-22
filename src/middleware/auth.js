const jwt = require('jsonwebtoken');

const authenticationMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET_KEY);
  } catch (error) {
    console.log('JWT verification failed:', error);
  }

  next();
};

const ensureAuthenticated = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  next();
};

const restrictToRole = (role) => (req, res, next) => {
  const userRole = req.user?.role;
  const hasRole = Array.isArray(userRole) ? userRole.includes(role) : userRole === role;

  if (!hasRole) {
    return res.status(403).json({ message: 'Forbidden: Insufficient privileges' });
  }

  next();
};

module.exports = {
  authenticationMiddleware,
  ensureAuthenticated,
  restrictToRole,
};

