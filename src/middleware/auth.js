const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Decode JWT and attach user to request (no blocking)
const authenticationMiddleware = async (req, res, next) => {
  const authHeader = (req.headers.authorization || '').trim();

  if (!authHeader) {
    return next();
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token || token === 'null' || token === 'undefined') {
    return res.status(401).json({ message: 'Invalid authorization header' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET_KEY);
    return next();
  } catch (error) {
    console.log('JWT verification failed:', error.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Require authentication
const ensureAuthenticated = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized - Please login' });
  }
  next();
};

// Restrict to specific role(s) - supports array or single role
const restrictToRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized - Please login' });
  }

  const userRole = req.user.role;
  
  // superAdmin can access everything
  if (userRole === 'superAdmin') {
    return next();
  }

  // Check if user has one of the allowed roles
  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({ 
      message: 'Forbidden - Insufficient privileges',
      requiredRole: allowedRoles,
      yourRole: userRole
    });
  }

  next();
};

// Institute-scoped access: admin can only access their institute's data
const ensureInstituteAccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userRole = req.user.role;

    // superAdmin bypasses all checks
    if (userRole === 'superAdmin') {
      return next();
    }

    // Only admin needs institute scoping
    if (userRole !== 'admin') {
      return next();
    }

    // Get admin's institute
    const institute = await prisma.institutions.findFirst({
      where: { adminUserId: req.user.id }
    });

    if (!institute) {
      return res.status(403).json({ message: 'Admin institute not found' });
    }

    // Attach instituteId to request for downstream validation
    req.adminInstituteId = institute.id;
    next();
  } catch (error) {
    console.error('Institute access check error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Ensure resource belongs to user's institute (for admin)
const validateInstituteResource = (getInstituteId) => async (req, res, next) => {
  try {
    const userRole = req.user?.role;

    // superAdmin bypasses
    if (userRole === 'superAdmin') {
      return next();
    }

    // Only enforce for admin
    if (userRole === 'admin') {
      const resourceInstituteId = await getInstituteId(req, prisma);
      
      if (req.adminInstituteId && resourceInstituteId !== req.adminInstituteId) {
        return res.status(403).json({ 
          message: 'Forbidden - Resource belongs to different institute' 
        });
      }
    }

    next();
  } catch (error) {
    console.error('Institute resource validation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Ownership check: user can only access their own resource
const ensureOwnership = (getUserId) => async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userRole = req.user.role;

    // superAdmin bypasses
    if (userRole === 'superAdmin') {
      return next();
    }

    const resourceUserId = await getUserId(req, prisma);

    if (resourceUserId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden - Not your resource' });
    }

    next();
  } catch (error) {
    console.error('Ownership check error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  authenticationMiddleware,
  ensureAuthenticated,
  restrictToRole,
  ensureInstituteAccess,
  validateInstituteResource,
  ensureOwnership,
};

