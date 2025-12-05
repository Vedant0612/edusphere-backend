const express = require('express');
const router = express.Router();
const { ensureAuthenticated, restrictToRole, ensureInstituteAccess } = require('../middleware/auth');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// REGISTER FACULTY PROFILE (Manual fallback - normally auto-created via admin invite)
// Use this endpoint only if faculty user exists but profile wasn't created
router.post('/register', ensureAuthenticated, restrictToRole('admin', 'superAdmin'), ensureInstituteAccess, async (req, res) => {
    try {
        const { instituteId, userId, department } = req.body;
        const userRole = req.user.role;
        const requesterId = req.user.id;

        if (!instituteId || !userId || !department) {
            return res.status(400).json({ 
                error: 'instituteId, userId, and department are required fields.' 
            });
        }

        // Verify user exists and has faculty role
        const user = await prisma.users.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.role !== 'faculty') {
            return res.status(400).json({ error: 'User must have faculty role' });
        }

        // Verify institute exists
        const institute = await prisma.institutions.findUnique({ 
            where: { id: instituteId } 
        });
        
        if (!institute) {
            return res.status(404).json({ error: 'Institute not found' });
        }

        // Check if admin is registering for their own institute
        if (userRole === 'admin') {
            if (institute.adminUserId !== requesterId) {
                return res.status(403).json({ 
                    error: 'Can only register faculty for your own institute' 
                });
            }
        }

        // Check if faculty profile already exists
        const existingFaculty = await prisma.faculty.findUnique({
            where: { userId }
        });

        if (existingFaculty) {
            return res.status(400).json({ error: 'Faculty profile already exists' });
        }

        const faculty = await prisma.faculty.create({
            data: {
                instituteId,
                userId,
                name: user.displayName,
                department,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        displayName: true,
                        email: true,
                        phone: true
                    }
                },
                institution: {
                    select: {
                        instituteName: true,
                        state: true
                    }
                }
            }
        });
        
        res.status(201).json({ 
            message: 'Faculty profile created successfully', 
            faculty,
            note: 'This endpoint is a fallback. Use POST /auth/admin/users/invite for normal faculty creation.'
        });
    } catch (error) {
        console.error('Register faculty error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// GET ALL FACULTY (public or authenticated with filters)
router.get('/', async (req, res) => {
    try {
        const { instituteId, department, search } = req.query;

        const where = {};
        if (instituteId) where.instituteId = instituteId;
        if (department) where.department = department;
        if (search) {
            where.name = { contains: search, mode: 'insensitive' };
        }

        const facultyList = await prisma.faculty.findMany({
            where,
            include: {
                user: {
                    select: {
                        displayName: true,
                        email: true
                    }
                },
                institution: {
                    select: {
                        instituteName: true,
                        state: true
                    }
                },
                _count: {
                    select: {
                        students: true,
                        evaluations: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        });

        res.json({ faculty: facultyList, count: facultyList.length });
    } catch (error) {
        console.error('Get faculty error:', error);
        res.status(500).json({ error: 'Failed to fetch faculty' });
    }
});

// GET FACULTY BY ID (public with basic info, authenticated for more)
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const faculty = await prisma.faculty.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        displayName: true,
                        email: true,
                        phone: true
                    }
                },
                institution: {
                    select: {
                        id: true,
                        instituteName: true,
                        state: true
                    }
                },
                _count: {
                    select: {
                        students: true,
                        evaluations: true
                    }
                }
            }
        });

        if (!faculty) {
            return res.status(404).json({ error: 'Faculty not found' });
        }

        res.json({ faculty });
    } catch (error) {
        console.error('Get faculty by ID error:', error);
        res.status(500).json({ error: 'Failed to fetch faculty' });
    }
});

// GET MY FACULTY PROFILE (authenticated faculty)
router.get('/me/profile', ensureAuthenticated, restrictToRole('faculty'), async (req, res) => {
    try {
        const userId = req.user.id;

        const faculty = await prisma.faculty.findUnique({
            where: { userId },
            include: {
                user: {
                    select: {
                        id: true,
                        displayName: true,
                        email: true,
                        phone: true,
                        role: true
                    }
                },
                institution: {
                    select: {
                        id: true,
                        instituteName: true,
                        state: true
                    }
                },
                students: {
                    select: {
                        id: true,
                        user: {
                            select: {
                                displayName: true,
                                email: true
                            }
                        },
                        department: true
                    }
                },
                _count: {
                    select: {
                        students: true,
                        evaluations: true
                    }
                }
            }
        });

        if (!faculty) {
            return res.status(404).json({ error: 'Faculty profile not found' });
        }

        res.json({ faculty });
    } catch (error) {
        console.error('Get my faculty profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// UPDATE FACULTY PROFILE (owner or superAdmin)
router.patch('/:id', ensureAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { department, name } = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;

        // Get faculty to check ownership
        const faculty = await prisma.faculty.findUnique({
            where: { id }
        });

        if (!faculty) {
            return res.status(404).json({ error: 'Faculty not found' });
        }

        // Check permissions
        if (userRole !== 'superAdmin' && faculty.userId !== userId) {
            return res.status(403).json({ error: 'Forbidden - Not your profile' });
        }

        // Update faculty
        const updateData = {};
        if (department) updateData.department = department;
        if (name) updateData.name = name;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        const updatedFaculty = await prisma.faculty.update({
            where: { id },
            data: updateData,
            include: {
                user: {
                    select: {
                        displayName: true,
                        email: true
                    }
                },
                institution: {
                    select: {
                        instituteName: true
                    }
                }
            }
        });

        res.json({ 
            message: 'Faculty profile updated', 
            faculty: updatedFaculty 
        });
    } catch (error) {
        console.error('Update faculty error:', error);
        res.status(500).json({ error: 'Failed to update faculty' });
    }
});

// UPDATE MY PROFILE (authenticated faculty using their credentials)
router.patch('/me/update', ensureAuthenticated, restrictToRole('faculty'), async (req, res) => {
    try {
        const userId = req.user.id;
        const { department, name, phone } = req.body;

        // Find faculty profile
        const faculty = await prisma.faculty.findUnique({
            where: { userId }
        });

        if (!faculty) {
            return res.status(404).json({ error: 'Faculty profile not found' });
        }

        // Build update objects
        const facultyUpdate = {};
        const userUpdate = {};

        if (department) facultyUpdate.department = department;
        if (name) {
            facultyUpdate.name = name;
            userUpdate.displayName = name;
        }
        if (phone) userUpdate.phone = phone;

        // Check if there's anything to update
        if (Object.keys(facultyUpdate).length === 0 && Object.keys(userUpdate).length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        // Build transaction operations (only include if there's data to update)
        const operations = [];
        
        if (Object.keys(facultyUpdate).length > 0) {
            operations.push(
                prisma.faculty.update({
                    where: { id: faculty.id },
                    data: facultyUpdate
                })
            );
        }
        
        if (Object.keys(userUpdate).length > 0) {
            operations.push(
                prisma.users.update({
                    where: { id: userId },
                    data: userUpdate
                })
            );
        }

        // Execute transaction
        await prisma.$transaction(operations);

        // Fetch complete profile
        const completeProfile = await prisma.faculty.findUnique({
            where: { id: faculty.id },
            include: {
                user: {
                    select: {
                        id: true,
                        displayName: true,
                        email: true,
                        phone: true
                    }
                },
                institution: {
                    select: {
                        instituteName: true,
                        state: true
                    }
                }
            }
        });

        res.json({ 
            message: 'Profile updated successfully', 
            faculty: completeProfile 
        });
    } catch (error) {
        console.error('Update my profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// DELETE FACULTY (superAdmin or admin from same institute)
router.delete('/:id', ensureAuthenticated, restrictToRole('admin', 'superAdmin'), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        // Get faculty
        const faculty = await prisma.faculty.findUnique({
            where: { id },
            select: { instituteId: true }
        });

        if (!faculty) {
            return res.status(404).json({ error: 'Faculty not found' });
        }

        // Check permissions for admin
        if (userRole === 'admin') {
            const adminInstitute = await prisma.institutions.findFirst({
                where: { adminUserId: userId }
            });

            if (!adminInstitute || adminInstitute.id !== faculty.instituteId) {
                return res.status(403).json({ 
                    error: 'Can only delete faculty from your institute' 
                });
            }
        }

        // Delete faculty
        await prisma.faculty.delete({
            where: { id }
        });

        res.json({ message: 'Faculty deleted successfully' });
    } catch (error) {
        console.error('Delete faculty error:', error);
        res.status(500).json({ error: 'Failed to delete faculty' });
    }
});

// GET FACULTY'S ADVISEES/STUDENTS (faculty owner, admin from institute, superAdmin)
router.get('/:id/advisees', ensureAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        // Get faculty
        const faculty = await prisma.faculty.findUnique({
            where: { id },
            select: {
                userId: true,
                instituteId: true
            }
        });

        if (!faculty) {
            return res.status(404).json({ error: 'Faculty not found' });
        }

        // Check permissions
        const isOwner = faculty.userId === userId;
        const isSuperAdmin = userRole === 'superAdmin';
        
        let isInstituteAdmin = false;
        if (userRole === 'admin') {
            const adminInstitute = await prisma.institutions.findFirst({
                where: { adminUserId: userId }
            });
            isInstituteAdmin = adminInstitute && adminInstitute.id === faculty.instituteId;
        }

        if (!isOwner && !isInstituteAdmin && !isSuperAdmin) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Get students
        const students = await prisma.profile.findMany({
            where: { facultyId: id },
            include: {
                user: {
                    select: {
                        id: true,
                        displayName: true,
                        email: true,
                        phone: true
                    }
                },
                internshipApplications: {
                    select: {
                        id: true,
                        status: true,
                        internship: {
                            select: {
                                title: true,
                                company: {
                                    select: {
                                        companyName: true
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: {
                user: { displayName: 'asc' }
            }
        });

        res.json({ students, count: students.length });
    } catch (error) {
        console.error('Get advisees error:', error);
        res.status(500).json({ error: 'Failed to fetch advisees' });
    }
});

// GET COURSE ANALYTICS (placeholder - requires courses implementation)
router.get('/:id/reports/course/:courseId', ensureAuthenticated, restrictToRole('faculty', 'admin', 'superAdmin'), async (req, res) => {
    try {
        const { id, courseId } = req.params;

        // TODO: Implement course analytics when courses module is ready
        res.status(501).json({ 
            message: 'Course analytics not yet implemented',
            note: 'This endpoint will be available when courses module is completed'
        });
    } catch (error) {
        console.error('Get course analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

module.exports = router;