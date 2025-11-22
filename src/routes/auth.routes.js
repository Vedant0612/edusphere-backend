// src/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const { authenticationMiddleware, ensureAuthenticated } = require('../middleware/auth');
const { randomBytes, createHmac } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// REGISTER USER
router.post('/register', async (req, res) => {
  try {
    const { displayName, email, password, role = [], phone } = req.body;
    
    // Normalize role to array
    const normalizedRole = Array.isArray(role) ? role : [role];

    // Check if user exists
    const existingUser = await prisma.users.findUnique({
      where: {
        email: email,
      },
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
        email,
        displayName,
        role: normalizedRole,
        hashPassword: hash,
        salt,
        phone,
      },
    });

    res.status(201).json({ 
      message: 'User created successfully', 
      id: user.id 
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// LOGIN USER
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
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

    // Create JWT payload
    const payload = {
      id: user.id,
      email: user.email,
      name: user.displayName,
      role: user.role,
      phone: user.phone
    };

    // Sign JWT token
    const token = jwt.sign(payload, process.env.JWT_SECRET_KEY);

    // Set Authorization header
    res.setHeader('Authorization', `Bearer ${token}`);
    
    // Return response
    res.status(200).json({ 
      message: 'Login successful', 
      id: user.id,
      token: token 
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;