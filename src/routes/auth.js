// src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// REGISTER USER
router.post('/register', async (req, res) => {
  try {
    const { displayName, email, password, role, phone } = req.body;

    // Validate input
    if (!displayName || !email || !password || !phone) {
      return res.status(400).json({ error: 'All fields required' });
    }

    // Check if user exists
    const existingUser = await prisma.users.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Generate salt
    const salt = await bcrypt.genSalt(10);
    
    // Hash password with salt
    const hashPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await prisma.users.create({
      data: {
        displayName,
        email,
        hashPassword,
        salt,
        phone,
        role: role || ['student'] // Default to student if not provided
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        phone: true
      }
    });

    res.status(201).json({ 
      message: 'User registered successfully',
      user 
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

// LOGIN USER
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const user = await prisma.users.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.hashPassword);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key-change-this',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      id: user.id,
      user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

module.exports = router;