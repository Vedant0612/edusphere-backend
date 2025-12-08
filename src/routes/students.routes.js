const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { ensureAuthenticated, restrictToRole } = require('../middleware/auth');
const { upload } = require('../middleware/uploads');
const { uploadOnCloudinary } = require('../services/cloudinary.service');

const router = express.Router();
const prisma = new PrismaClient();

const toStringArray = (value, fallback = []) => {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch (err) {
      // ignore JSON parse errors and fallback to comma split
    }
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return fallback;
};

// CREATE STUDENT PROFILE (requires authentication)
// Supports file upload for avatar - if file present, uploads to Cloudinary
router.post('/', ensureAuthenticated, upload.any(), async (req, res) => {
  try {
    // Debug: Log what we're receiving
    console.log('=== REQUEST DEBUG ===');
    console.log('req.body:', req.body);
    console.log('req.files:', req.files);
    console.log('==================');

    const {
      userId,
      instituteId,
      facultyId,
      bio,
      gender,
      DOB,
      avatarURL,
      github,
      linkedin,
      skills,
      interests,
      department,
      resourceId,
      graduationYear,
    } = req.body;

    if (!userId || !instituteId) {
      return res.status(400).json({
        error: 'userId and instituteId are required fields.',
        received: { userId, instituteId, allKeys: Object.keys(req.body) }
      });
    }

    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

        // remove this from comments as currently nothing in institution and faculty tables
    const institution = await prisma.institutions.findUnique({ where: { id: instituteId } });
    if (!institution) {
      return res.status(404).json({ error: 'Institution not found' });
     }

    if (facultyId) {
      const faculty = await prisma.faculty.findUnique({ where: { id: facultyId } });
      if (!faculty) {
        return res.status(404).json({ error: 'Faculty not found' });
      }
    }

    const existingProfile = await prisma.profile.findUnique({ where: { userId } });
    if (existingProfile) {
      return res.status(400).json({ error: 'Student profile already exists' });
    }

    // Handle file upload if present (avatar)
    let uploadedAvatarURL = avatarURL;
    const file = req.files && req.files.length > 0 ? req.files[0] : req.file;
    if (file) {
      try {
        uploadedAvatarURL = await uploadOnCloudinary(file.path);
      } catch (uploadError) {
        console.error('Avatar upload failed:', uploadError);
        return res.status(500).json({ error: 'Failed to upload avatar image' });
      }
    }

    const profile = await prisma.profile.create({
      data: {
        userId,
        instituteId,
        facultyId,
        bio,
        gender,
        DOB: DOB ? new Date(DOB) : null,
        avatarURL: uploadedAvatarURL,
        github,
        linkedin,
        skills: toStringArray(skills),
        interests: toStringArray(interests),
        department,
        resourceId,
        graduationYear: graduationYear ? parseInt(graduationYear) : null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
        // institution: true
        // faculty: true,
      },
    });

    res.status(201).json({ message: 'Student profile created', profile });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create student profile' });
  }
});

// GET STUDENT PROFILE BY USER ID
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const profile = await prisma.profile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            role: true,
            phone: true,
            graduationYear: true,
          },
        },
        institution: {
          select: {
            id: true,
            instituteName: true,
            state: true,
            city: true,
          },
        },
        faculty: {
          select: {
            id: true,
            name: true,
            department: true,
          },
        },
        portfolioProjects: true,
        credits: true,
        certificates: true,
      },
    });

    if (!profile) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    res.json(profile);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch student profile' });
  }
});

// UPDATE STUDENT PROFILE BY USER ID
router.put('/user/:userId', ensureAuthenticated, upload.any(), async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch existing profile
    const existing = await prisma.profile.findUnique({
      where: { userId },
      select: { id: true, userId: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Authorization check
    if (String(req.user.id) !== String(existing.userId)) {
      return res.status(403).json({ error: 'Forbidden — you can only edit your own profile' });
    }

    // Handle file upload if present (avatar)
    let uploadedAvatarURL;
    const file = req.files && req.files.length > 0 ? req.files[0] : req.file;
    if (file) {
      try {
        uploadedAvatarURL = await uploadOnCloudinary(file.path);
      } catch (uploadError) {
        console.error('Avatar upload failed:', uploadError);
        return res.status(500).json({ error: 'Failed to upload avatar image' });
      }
    }

    // Extract updatable fields
    const {
      bio,
      gender,
      DOB,
      avatarURL,
      github,
      linkedin,
      skills,
      interests,
      department,
      resourceId,
      graduationYear,
    } = req.body;

    const clean = (v) => (v === '' ? null : v === undefined ? undefined : v);

    const data = {
      bio: clean(bio),
      gender: clean(gender),
      DOB: DOB ? new Date(DOB) : undefined,
      avatarURL: uploadedAvatarURL || clean(avatarURL),
      github: clean(github),
      linkedin: clean(linkedin),
      skills: skills !== undefined ? toStringArray(skills) : undefined,
      interests: interests !== undefined ? toStringArray(interests) : undefined,
      department: clean(department),
      resourceId: clean(resourceId),
      graduationYear: graduationYear ? parseInt(graduationYear) : undefined,
    };

    // Remove undefined keys
    Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    const profile = await prisma.profile.update({
      where: { userId },
      data,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            role: true,
            phone: true,
          },
        },
        institution: {
          select: {
            id: true,
            instituteName: true,
            state: true,
            city: true,
          },
        },
      },
    });

    return res.status(200).json({ message: 'Profile updated successfully', profile });
  } catch (error) {
    console.error('Profile update error:', error);
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Student profile not found' });
    }
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET STUDENT PROFILE BY ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const profile = await prisma.profile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            role: true,
          },
        },
        institution: true,
        faculty: true,
        mentorSessions: true,
        mentorReviews: true,
        portfolioProjects: true,
        credits: true,
        certificates: true,
        internshipApplications: {
          include: {
            internship: true,
            evaluations: true,
            logbookEntries: true,
          },
        },
        learningProgress: {
          include: {
            checkpoint: true,
          },
        },
      },
    });

    if (!profile) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    res.json({ profile });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch student profile' });
  }
});

// UPDATE STUDENT PROFILE (requires authentication)
// UPDATE PROFILE DETAILS (PARTIAL - student-only)
// Supports file upload for avatar - if file present, uploads to Cloudinary
router.patch('/:id/profile', ensureAuthenticated, upload.any(), async (req, res) => {
  try {
    const { id } = req.params;

   

    // Fetch existing profile to authorize
    const existing = await prisma.profile.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Profile not found' });
    }

     if (String(req.user.id) !== String(existing.userId)) {
      return res.status(403).json({ error: 'Forbidden — you can only edit your own profile' });
    }

    // Handle file upload if present (avatar)
    let uploadedAvatarURL;
    const file = req.files && req.files.length > 0 ? req.files[0] : req.file;
    if (file) {
      try {
        uploadedAvatarURL = await uploadOnCloudinary(file.path);
      } catch (uploadError) {
        console.error('Avatar upload failed:', uploadError);
        return res.status(500).json({ error: 'Failed to upload avatar image' });
      }
    }

    // Extract possible updatable fields
    const {
      bio,
      gender,
      DOB,
      avatarURL,
      github,
      linkedin,
      skills,
      interests,
      department,
      resourceId,
      instituteId,
      facultyId,
    } = req.body;

    const clean = (v) => (v === '' ? null : v === undefined ? undefined : v);

    const data = {
      bio: clean(bio),
      gender: clean(gender),
      DOB: DOB ? new Date(DOB) : undefined,
      avatarURL: uploadedAvatarURL || clean(avatarURL), // Use uploaded URL if file provided
      github: clean(github),
      linkedin: clean(linkedin),
      skills: skills !== undefined ? toStringArray(skills) : undefined,
      interests: interests !== undefined ? toStringArray(interests) : undefined,
      department: clean(department),
      resourceId:
        resourceId !== undefined && resourceId !== null && resourceId !== '' ? Number(resourceId) : undefined,
      instituteId:
        instituteId !== undefined && instituteId !== null && instituteId !== '' ? Number(instituteId) : undefined,
      facultyId:
        facultyId !== undefined && facultyId !== null && facultyId !== '' ? Number(facultyId) : undefined,
    };

    // Remove undefined keys so Prisma ignores them
    Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    const profile = await prisma.profile.update({
      where: { id },
      data,
      include: {
        user: true,
        institution: true,
        faculty: true,
      },
    });

    return res.status(200).json({ message: 'Profile details updated', profile });
  } catch (error) {
    console.error('Profile PATCH error:', error);
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Student profile not found' });
    }
    return res.status(500).json({ error: 'Failed to update profile details' });
  }
});

// GET STUDENT'S INTERNSHIP APPLICATIONS (student owner, admin from same institute, superAdmin)
router.get('/:id/applications', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get student profile
    const student = await prisma.profile.findUnique({
      where: { id },
      select: {
        userId: true,
        instituteId: true
      }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Check permissions
    const isOwner = student.userId === userId;
    const isSuperAdmin = userRole === 'superAdmin';
    
    let isInstituteAdmin = false;
    if (userRole === 'admin') {
      const adminInstitute = await prisma.institutions.findFirst({
        where: { adminUserId: userId }
      });
      isInstituteAdmin = adminInstitute && adminInstitute.id === student.instituteId;
    }

    if (!isOwner && !isInstituteAdmin && !isSuperAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Build query
    const where = { student_id: id };
    if (status) where.status = status;

    const applications = await prisma.internship_applications.findMany({
      where,
      include: {
        internship: {
          include: {
            company: {
              select: {
                companyName: true,
                location: true
              }
            }
          }
        },
        logbookEntries: {
          select: {
            id: true,
            date: true,
            hours_spent: true,
            verifiedByFaculty: true
          }
        },
        evaluations: {
          select: {
            final_score: true,
            comments: true
          }
        }
      },
      orderBy: { applied_at: 'desc' }
    });

    res.json({ applications, count: applications.length });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// GET STUDENT'S MENTORS (student owner, admin, faculty, superAdmin)
router.get('/:id/mentors', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get student profile
    const student = await prisma.profile.findUnique({
      where: { id },
      select: {
        userId: true,
        instituteId: true,
        facultyId: true
      }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Check permissions
    const isOwner = student.userId === userId;
    const isSuperAdmin = userRole === 'superAdmin';
    
    let hasAccess = isOwner || isSuperAdmin;
    
    if (userRole === 'admin') {
      const adminInstitute = await prisma.institutions.findFirst({
        where: { adminUserId: userId }
      });
      hasAccess = adminInstitute && adminInstitute.id === student.instituteId;
    }

    if (userRole === 'faculty') {
      const faculty = await prisma.faculty.findUnique({
        where: { userId }
      });
      hasAccess = faculty && faculty.id === student.facultyId;
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Get assigned faculty
    const assignedFaculty = student.facultyId ? await prisma.faculty.findUnique({
      where: { id: student.facultyId },
      include: {
        user: {
          select: {
            displayName: true,
            email: true,
            phone: true
          }
        }
      }
    }) : null;

    // Get mentor sessions
    const mentorSessions = await prisma.mentorSessions.findMany({
      where: { studentId: id },
      include: {
        mentor: {
          include: {
            user: {
              select: {
                displayName: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { scheduled_at: 'desc' }
    });

    res.json({
      assignedFaculty,
      mentorSessions,
      sessionCount: mentorSessions.length
    });
  } catch (error) {
    console.error('Get mentors error:', error);
    res.status(500).json({ error: 'Failed to fetch mentors' });
  }
});

// UPLOAD/UPDATE RESUME (student owner, superAdmin)
router.post('/:id/resume', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { resumeUrl } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!resumeUrl) {
      return res.status(400).json({ error: 'resumeUrl is required' });
    }

    // Get student profile
    const student = await prisma.profile.findUnique({
      where: { id },
      select: { userId: true }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Check permissions
    if (userRole !== 'superAdmin' && student.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden - Not your profile' });
    }

    // Update profile with resume URL (using resourceId field for now)
    const updatedProfile = await prisma.profile.update({
      where: { id },
      data: {
        resourceId: resumeUrl
      }
    });

    res.json({ 
      message: 'Resume uploaded successfully',
      resumeUrl: updatedProfile.resourceId
    });
  } catch (error) {
    console.error('Upload resume error:', error);
    res.status(500).json({ error: 'Failed to upload resume' });
  }
});

module.exports = router;