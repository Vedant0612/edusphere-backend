// src/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const { authenticationMiddleware, ensureAuthenticated } = require('../middleware/auth');
const { randomBytes, createHmac } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to generate access token (24h expiry since no refresh token mechanism)
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.displayName,
      role: user.role,
      phone: user.phone
    },
    process.env.JWT_SECRET_KEY,
    { expiresIn: '24h' }
  );
};

// REGISTER USER
router.post('/register', async (req, res) => {
  try {
    const { displayName, email, password, role = [], phone } = req.body;
    
    // Validate required fields
    if (!displayName || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // Validate self-registration roles (admin, faculty, superAdmin by invite only)
    const allowedRoles = ['student', 'mentor', 'company'];
    
    if (role && !allowedRoles.includes(role)) {
      return res.status(403).json({ 
        message: 'Self-registration only allowed for student, mentor, or company roles' 
      });
    }

    // Default to student if no role specified
    const userRole = role || 'student';

    // Check if user exists
    const existingUser = await prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Generate salt and hash password
    const salt = randomBytes(16).toString('hex'); 
    const hash = createHmac('sha256', salt)
      .update(password)
      .digest('hex');

    // Create user
    const user = await prisma.users.create({
      data: {
        displayName,
        role: userRole,
        hashPassword: hash,
        salt,
        phone: phone || '',
      },
    });

    res.status(201).json({ 
      message: 'User created successfully', 
      id: user.id,
      role: user.role
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      message: 'Internal server error',
      error: error.message 
    });
  }
});

// LOGIN USER
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const user = await prisma.users.findUnique({
      where: { email },
    });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    // Hash the provided password with stored salt
    const hash = createHmac('sha256', user.salt)
      .update(password)
      .digest('hex');
    
    // Compare hashes
    if (hash !== user.hashPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate access token
    const token = generateAccessToken(user);

    // Return response
    res.status(200).json({ 
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        phone: user.phone
      },
      token
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
// ADMIN/SUPERADMIN INVITE USER
router.post('/admin/users/invite', ensureAuthenticated, async (req, res) => {
  try {
    const { email, role, instituteId, displayName } = req.body;
    const inviterRole = req.user.role;

    // Validate inviter permissions
    if (inviterRole === 'admin') {
      // Institute admin can only invite faculty within their institute
      if (role !== 'faculty' || !instituteId) {
        return res.status(403).json({ 
          message: 'Institute admin can only invite faculty for their institute' 
        });
      }

      // Verify this admin manages this institute
      const adminInstitute = await prisma.institutions.findFirst({
        where: { adminUserId: req.user.id }
      });

      if (!adminInstitute || adminInstitute.id !== instituteId) {
        return res.status(403).json({ message: 'Cannot invite for this institute' });
      }
    } else if (inviterRole !== 'superAdmin') {
      return res.status(403).json({ message: 'Only admin or superAdmin can invite users' });
    }

    // Check if user exists
    const existingUser = await prisma.users.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Generate temporary password
    const tempPassword = randomBytes(12).toString('hex');
    const salt = randomBytes(16).toString('hex');
    const hash = createHmac('sha256', salt)
      .update(tempPassword)
      .digest('hex');

    // Create user
    const user = await prisma.users.create({
      data: {
        email,
        displayName: displayName || email.split('@')[0],
        role,
        hashPassword: hash,
        salt,
        phone: '',
      },
    });

    // If inviting faculty, auto-create faculty profile
    if (role === 'faculty' && instituteId) {
      await prisma.faculty.create({
        data: {
          userId: user.id,
          instituteId,
          name: user.displayName,
          department: 'Not Assigned', // Default department
        }
      });
    }

    // TODO: Send invitation email with tempPassword
    console.log(`Invitation sent to ${email}. Temporary password: ${tempPassword}`);

    res.status(201).json({ 
      message: 'User invited successfully',
      userId: user.id,
      email: user.email,
      role: user.role,
      tempPassword // Remove in production, send via email only
    });

  } catch (error) {
    console.error('Invite user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// OAUTH PLACEHOLDER (Google/GitHub)
router.post('/oauth/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { code, idToken } = req.body;

    // TODO: Implement OAuth flow for each provider
    // 1. Validate the code/idToken with the provider
    // 2. Extract user info (email, name, etc.)
    // 3. Create or find user in database
    // 4. Generate tokens and return

    res.status(501).json({ 
      message: `OAuth for ${provider} not yet implemented`,
      note: 'This endpoint requires OAuth client setup and token validation'
    });

  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
module.exports = router;