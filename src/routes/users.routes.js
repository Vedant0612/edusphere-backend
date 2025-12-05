const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { ensureAuthenticated, restrictToRole, ensureInstituteAccess } = require('../middleware/auth');
const { randomBytes, createHmac } = require('node:crypto');

const router = express.Router();
const prisma = new PrismaClient();

// GET ALL USERS (admin sees their institute users, superAdmin sees all)
router.get('/', ensureAuthenticated, restrictToRole('admin', 'superAdmin'), ensureInstituteAccess, async (req, res) => {
  try {
    const { role, instituteId, search } = req.query;
    const userRole = req.user.role;
    
    const where = {};

    // Admin can only see users from their institute
    if (userRole === 'admin' && req.adminInstituteId) {
      // Get profiles from their institute
      const profiles = await prisma.profile.findMany({
        where: { instituteId: req.adminInstituteId },
        select: { userId: true }
      });
      
      // Get faculty from their institute
      const faculty = await prisma.faculty.findMany({
        where: { instituteId: req.adminInstituteId },
        select: { userId: true }
      });

      const userIds = [
        ...profiles.map(p => p.userId),
        ...faculty.map(f => f.userId)
      ];

      where.id = { in: userIds };
    }

    // Filter by role if specified
    if (role) {
      where.role = role;
    }

    // Search by name or email
    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const users = await prisma.users.findMany({
      where,
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        phone: true
      },
      orderBy: { displayName: 'asc' }
    });

    res.json({ users, count: users.length });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET MY PROFILE (authenticated user)
router.get('/me', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        phone: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get role-specific data
    let roleData = null;

    if (user.role === 'student') {
      roleData = await prisma.profile.findUnique({
        where: { userId },
        include: {
          institution: {
            select: { instituteName: true, state: true }
          },
          faculty: {
            select: { 
              name: true, 
              user: { select: { email: true } }
            }
          }
        }
      });
    } else if (user.role === 'faculty') {
      roleData = await prisma.faculty.findUnique({
        where: { userId },
        include: {
          institution: {
            select: { instituteName: true, state: true }
          }
        }
      });
    } else if (user.role === 'mentor') {
      roleData = await prisma.mentors.findUnique({
        where: { user_id: userId }
      });
    } else if (user.role === 'company') {
      roleData = await prisma.companies.findUnique({
        where: { userId }
      });
    } else if (user.role === 'admin') {
      roleData = await prisma.institutions.findFirst({
        where: { adminUserId: userId }
      });
    }

    res.json({ user, roleData });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// GET USER BY ID (public safe fields, full for owner/superAdmin)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const requesterId = req.user?.id;
    const requesterRole = req.user?.role;

    const isOwner = requesterId === id;
    const isSuperAdmin = requesterRole === 'superAdmin';

    // Public fields
    const publicSelect = {
      id: true,
      displayName: true,
      role: true
    };

    // Full fields for owner/superAdmin
    const fullSelect = {
      id: true,
      displayName: true,
      email: true,
      role: true,
      phone: true
    };

    const user = await prisma.users.findUnique({
      where: { id },
      select: isOwner || isSuperAdmin ? fullSelect : publicSelect
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// UPDATE USER (owner or superAdmin)
router.patch('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, email, phone } = req.body;
    const requesterId = req.user.id;
    const requesterRole = req.user.role;

    // Check permissions
    if (requesterRole !== 'superAdmin' && requesterId !== id) {
      return res.status(403).json({ error: 'Forbidden - Can only update your own profile' });
    }

    // Prepare update data
    const updateData = {};
    if (displayName) updateData.displayName = displayName;
    if (email) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Update user
    const user = await prisma.users.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        phone: true
      }
    });

    res.json({ message: 'User updated', user });
  } catch (error) {
    console.error('Update user error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Email already in use' });
    }
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// CHANGE USER ROLE (superAdmin only)
router.put('/:id/role', ensureAuthenticated, restrictToRole('superAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['student', 'faculty', 'mentor', 'company', 'admin', 'superAdmin'];
    
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role', 
        validRoles 
      });
    }

    const user = await prisma.users.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true
      }
    });

    res.json({ message: 'User role updated', user });
  } catch (error) {
    console.error('Change role error:', error);
    res.status(500).json({ error: 'Failed to change user role' });
  }
});

// CHANGE PASSWORD (authenticated user - own password)
router.patch('/me/password', ensureAuthenticated, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'currentPassword and newPassword are required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: 'New password must be at least 6 characters' 
      });
    }

    // Get user
    const user = await prisma.users.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const currentHash = createHmac('sha256', user.salt)
      .update(currentPassword)
      .digest('hex');

    if (currentHash !== user.hashPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Generate new salt and hash
    const newSalt = randomBytes(16).toString('hex');
    const newHash = createHmac('sha256', newSalt)
      .update(newPassword)
      .digest('hex');

    // Update password
    await prisma.users.update({
      where: { id: userId },
      data: {
        salt: newSalt,
        hashPassword: newHash
      }
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// SOFT DELETE USER (owner or superAdmin)
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const requesterId = req.user.id;
    const requesterRole = req.user.role;

    // Check permissions
    if (requesterRole !== 'superAdmin' && requesterId !== id) {
      return res.status(403).json({ error: 'Forbidden - Can only delete your own account' });
    }

    // For now, just deactivate by adding a flag (you can extend schema with isActive field)
    // Or actually delete if that's preferred
    await prisma.users.delete({
      where: { id }
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
