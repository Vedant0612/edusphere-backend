const express = require('express');
const router = express.Router();
const { ensureAuthenticated, restrictToRole } = require('../middleware/auth');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();


// CREATE INSTITUTE (superAdmin only)
router.post('/register', ensureAuthenticated, restrictToRole('superAdmin'), async (req, res) => {
    try {
        const { instituteName, state, adminUserId, createdAt } = req.body;
        
        if (!instituteName || !state || !adminUserId) {
            return res.status(400).json({ 
                error: 'instituteName, state, and adminUserId are required fields.' 
            });
        }

        // Verify admin user exists and has admin role
        const adminUser = await prisma.users.findUnique({ 
            where: { id: adminUserId } 
        });
        
        if (!adminUser) {
            return res.status(404).json({ error: 'Admin user not found' });
        }

        if (adminUser.role !== 'admin') {
            return res.status(400).json({ 
                error: 'User must have admin role' 
            });
        }

        // Check if admin already manages an institute
        const existingInstitute = await prisma.institutions.findFirst({
            where: { adminUserId }
        });

        if (existingInstitute) {
            return res.status(400).json({ 
                error: 'This admin already manages an institute' 
            });
        }

        const institute = await prisma.institutions.create({
            data: {
                instituteName,
                state,
                adminUserId,
                createdAt: createdAt ? new Date(createdAt) : new Date(),
            },
            include: {
                adminUser: {
                    select: {
                        id: true,
                        displayName: true,
                        email: true,
                        phone: true
                    }
                }
            }
        });
        
        res.status(201).json({ 
            message: 'Institute created successfully', 
            institute 
        });

    } catch (error) {
        console.error('Create institute error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// GET ALL INSTITUTES (public)
router.get('/', async (req, res) => {
    try {
        const { state, search } = req.query;
        
        const where = {};
        if (state) where.state = state;
        if (search) {
            where.instituteName = { 
                contains: search, 
                mode: 'insensitive' 
            };
        }

        const institutes = await prisma.institutions.findMany({
            where,
            select: {
                id: true,
                instituteName: true,
                state: true,
                createdAt: true,
                _count: {
                    select: {
                        profiles: true,
                        faculty: true
                    }
                }
            },
            orderBy: { instituteName: 'asc' }
        });
        
        res.json({ institutes, count: institutes.length });
    } catch (error) {
        console.error('Get institutes error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// GET INSTITUTE BY ID (public)
router.get('/:instituteId', async (req, res) => {
    try {
        const { instituteId } = req.params;
        
        const institute = await prisma.institutions.findUnique({
            where: { id: instituteId },
            include: {
                adminUser: {
                    select: {
                        id: true,
                        displayName: true,
                        email: true
                    }
                },
                _count: {
                    select: {
                        profiles: true,
                        faculty: true
                    }
                }
            }
        });
        
        if (!institute) {
            return res.status(404).json({ message: 'Institute not found' });
        }
        
        res.json({ institute });
    } catch (error) {
        console.error('Get institute error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// GET INSTITUTE ADMIN (admin of that institute or superAdmin)
router.get('/:instituteId/admin', ensureAuthenticated, restrictToRole('admin', 'superAdmin'), async (req, res) => {
    try {
        const { instituteId } = req.params;
        const userRole = req.user.role;
        const userId = req.user.id;

        const institute = await prisma.institutions.findUnique({
            where: { id: instituteId },
            include: {
                adminUser: {
                    select: {
                        id: true,
                        displayName: true,
                        email: true,
                        phone: true,
                        role: true,
                    }
                }
            }
        });
        
        if (!institute) {
            return res.status(404).json({ message: 'Institute not found' });
        }

        // Check if admin is requesting their own institute
        if (userRole === 'admin' && institute.adminUserId !== userId) {
            return res.status(403).json({ 
                error: 'Forbidden - Not your institute' 
            });
        }
        
        res.json({ admin: institute.adminUser });
    } catch (error) {
        console.error('Get institute admin error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// UPDATE INSTITUTE (superAdmin only)
router.patch('/:instituteId', ensureAuthenticated, restrictToRole('superAdmin'), async (req, res) => {
    try {
        const { instituteId } = req.params;
        const { instituteName, state, adminUserId } = req.body;

        // Verify institute exists
        const institute = await prisma.institutions.findUnique({
            where: { id: instituteId }
        });

        if (!institute) {
            return res.status(404).json({ error: 'Institute not found' });
        }

        // If changing admin, verify new admin
        if (adminUserId && adminUserId !== institute.adminUserId) {
            const newAdmin = await prisma.users.findUnique({
                where: { id: adminUserId }
            });

            if (!newAdmin) {
                return res.status(404).json({ error: 'New admin user not found' });
            }

            if (newAdmin.role !== 'admin') {
                return res.status(400).json({ 
                    error: 'User must have admin role' 
                });
            }

            // Check if new admin already manages another institute
            const existingInstitute = await prisma.institutions.findFirst({
                where: { 
                    adminUserId,
                    id: { not: instituteId }
                }
            });

            if (existingInstitute) {
                return res.status(400).json({ 
                    error: 'This admin already manages another institute' 
                });
            }
        }

        // Update institute
        const updateData = {};
        if (instituteName) updateData.instituteName = instituteName;
        if (state) updateData.state = state;
        if (adminUserId) updateData.adminUserId = adminUserId;

        const updatedInstitute = await prisma.institutions.update({
            where: { id: instituteId },
            data: updateData,
            include: {
                adminUser: {
                    select: {
                        id: true,
                        displayName: true,
                        email: true
                    }
                }
            }
        });

        res.json({ 
            message: 'Institute updated successfully', 
            institute: updatedInstitute 
        });
    } catch (error) {
        console.error('Update institute error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;