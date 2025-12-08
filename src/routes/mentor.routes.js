const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticationMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// ============================================
// MENTOR PROFILE & AUTH
// ============================================

/**
 * GET /api/mentor/me/profile
 * Get logged-in mentor's profile
 */
router.get('/me/profile', authenticationMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const mentor = await prisma.mentors.findUnique({
      where: { user_id: userId },
      include: {
        user: {
          select: { 
            id: true,
            displayName: true,
            email: true,
            phone: true
          }
        }
      }
    });

    if (!mentor) {
      return res.status(404).json({ 
        success: false,
        error: 'Mentor profile not found' 
      });
    }

    res.json({ 
      success: true,
      mentor: {
        id: mentor.id,
        userId: mentor.user_id,
        name: mentor.user.displayName,
        email: mentor.user.email,
        phone: mentor.user.phone,
        expertise: mentor.expertise,
        experience: mentor.experience,
        bio: mentor.bio,
        rating: mentor.rating
      }
    });
  } catch (error) {
    console.error('Error fetching mentor profile:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch mentor profile' 
    });
  }
});

/**
 * PUT /api/mentor/me/profile
 * Update mentor profile
 */
router.put('/me/profile', authenticationMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { expertise, bio, experience } = req.body;

    const mentor = await prisma.mentors.findUnique({
      where: { user_id: userId }
    });

    if (!mentor) {
      return res.status(404).json({ 
        success: false,
        error: 'Mentor profile not found' 
      });
    }

    const updated = await prisma.mentors.update({
      where: { id: mentor.id },
      data: { 
        expertise: expertise !== undefined ? expertise : mentor.expertise,
        experience: experience !== undefined ? experience : mentor.experience,
        bio: bio !== undefined ? bio : mentor.bio
      },
      include: {
        user: {
          select: { displayName: true, email: true, phone: true }
        }
      }
    });

    res.json({ 
      success: true,
      message: 'Profile updated successfully',
      mentor: updated 
    });
  } catch (error) {
    console.error('Error updating mentor profile:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update profile' 
    });
  }
});

// ============================================
// DASHBOARD & STATISTICS
// ============================================

/**
 * GET /api/mentor/me/stats
 * Get mentor dashboard statistics
 */
router.get('/me/stats', authenticationMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const mentor = await prisma.mentors.findUnique({
      where: { user_id: userId },
      select: { id: true }
    });

    if (!mentor) {
      return res.status(404).json({ 
        success: false,
        error: 'Mentor not found' 
      });
    }

    // Get session counts
    const [totalSessions, upcomingSessions, completedSessions] = await Promise.all([
      prisma.mentorSessions.count({
        where: { mentorId: mentor.id }
      }),
      prisma.mentorSessions.count({
        where: { 
          mentorId: mentor.id,
          status: 'scheduled'
        }
      }),
      prisma.mentorSessions.count({
        where: { 
          mentorId: mentor.id,
          status: 'completed'
        }
      })
    ]);

    // Get unique students count
    const uniqueStudents = await prisma.mentorSessions.groupBy({
      by: ['studentId'],
      where: { mentorId: mentor.id }
    });

    // Get average rating
    const reviews = await prisma.mentorReviews.findMany({
      where: { mentorId: mentor.id },
      select: { rating: true }
    });

    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    res.json({
      success: true,
      totalSessions,
      upcomingSessions,
      completedSessions,
      totalStudents: uniqueStudents.length,
      avgRating: parseFloat(avgRating.toFixed(1))
    });
  } catch (error) {
    console.error('Error fetching mentor stats:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch statistics' 
    });
  }
});

// ============================================
// MENTOR SESSIONS
// ============================================

/**
 * GET /api/mentor/me/sessions
 * Get all sessions for logged-in mentor
 */
router.get('/me/sessions', authenticationMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    const mentor = await prisma.mentors.findUnique({
      where: { user_id: userId },
      select: { id: true }
    });

    if (!mentor) {
      return res.status(404).json({ 
        success: false,
        error: 'Mentor not found' 
      });
    }

    const sessions = await prisma.mentorSessions.findMany({
      where: { 
        mentorId: mentor.id,
        ...(status ? { status } : {})
      },
      include: {
        student: {
          include: {
            user: {
              select: { 
                id: true,
                displayName: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { scheduled_at: 'desc' }
    });

    const formattedSessions = sessions.map(session => ({
      id: session.id,
      student: {
        id: session.student?.id,
        name: session.student?.user?.displayName || 'Unknown Student',
        email: session.student?.user?.email
      },
      scheduled_at: session.scheduled_at,
      topic: session.topic || 'General Mentoring',
      status: session.status,
      meeting_link: session.meeting_link,
      notes: session.notes,
      createdAt: session.createdAt
    }));

    res.json({ 
      success: true,
      sessions: formattedSessions 
    });
  } catch (error) {
    console.error('Error fetching mentor sessions:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch sessions' 
    });
  }
});

/**
 * GET /api/mentor/me/sessions/:id
 * Get specific session details
 */
router.get('/me/sessions/:id', authenticationMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const mentor = await prisma.mentors.findUnique({
      where: { user_id: userId },
      select: { id: true }
    });

    if (!mentor) {
      return res.status(404).json({ 
        success: false,
        error: 'Mentor not found' 
      });
    }

    const session = await prisma.mentorSessions.findFirst({
      where: { 
        id,
        mentorId: mentor.id 
      },
      include: {
        student: {
          include: {
            user: {
              select: { 
                displayName: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ 
        success: false,
        error: 'Session not found' 
      });
    }

    res.json({ 
      success: true,
      session 
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch session' 
    });
  }
});

/**
 * PUT /api/mentor/me/sessions/:id
 * Update session (status, notes, etc.)
 */
router.put('/me/sessions/:id', authenticationMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { status, notes, meeting_link } = req.body;

    const mentor = await prisma.mentors.findUnique({
      where: { user_id: userId },
      select: { id: true }
    });

    if (!mentor) {
      return res.status(404).json({ 
        success: false,
        error: 'Mentor not found' 
      });
    }

    // Verify session belongs to this mentor
    const session = await prisma.mentorSessions.findFirst({
      where: { 
        id,
        mentorId: mentor.id 
      }
    });

    if (!session) {
      return res.status(404).json({ 
        success: false,
        error: 'Session not found or unauthorized' 
      });
    }

    const updated = await prisma.mentorSessions.update({
      where: { id },
      data: { 
        status: status || session.status,
        notes: notes !== undefined ? notes : session.notes,
        meeting_link: meeting_link !== undefined ? meeting_link : session.meeting_link
      },
      include: {
        student: {
          include: {
            user: {
              select: { displayName: true, email: true }
            }
          }
        }
      }
    });

    res.json({ 
      success: true,
      message: 'Session updated successfully',
      session: updated 
    });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update session' 
    });
  }
});

// ============================================
// ASSIGNED STUDENTS
// ============================================

/**
 * GET /api/mentor/me/students
 * Get all students assigned to this mentor
 */
router.get('/me/students', authenticationMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const mentor = await prisma.mentors.findUnique({
      where: { user_id: userId },
      select: { id: true }
    });

    if (!mentor) {
      return res.status(404).json({ 
        success: false,
        error: 'Mentor not found' 
      });
    }

    // Get unique students from sessions
    const sessions = await prisma.mentorSessions.findMany({
      where: { mentorId: mentor.id },
      include: {
        student: {
          include: {
            user: {
              select: { 
                id: true,
                displayName: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { scheduled_at: 'desc' }
    });

    // Group by student and count sessions
    const studentMap = new Map();
    
    sessions.forEach(session => {
      const studentId = session.studentId;
      if (!studentMap.has(studentId)) {
        studentMap.set(studentId, {
          id: session.student.id,
          name: session.student.user?.displayName || 'Unknown',
          email: session.student.user?.email,
          totalSessions: 0,
          completedSessions: 0,
          upcomingSessions: 0,
          lastSession: null
        });
      }
      
      const student = studentMap.get(studentId);
      student.totalSessions++;
      
      if (session.status === 'completed') {
        student.completedSessions++;
      } else if (session.status === 'scheduled') {
        student.upcomingSessions++;
      }
      
      if (!student.lastSession || session.scheduled_at > student.lastSession) {
        student.lastSession = session.scheduled_at;
      }
    });

    const students = Array.from(studentMap.values());

    res.json({ 
      success: true,
      students 
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch students' 
    });
  }
});

/**
 * GET /api/mentor/me/students/:studentId
 * Get detailed info about a specific student
 */
router.get('/me/students/:studentId', authenticationMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { studentId } = req.params;

    const mentor = await prisma.mentors.findUnique({
      where: { user_id: userId },
      select: { id: true }
    });

    if (!mentor) {
      return res.status(404).json({ 
        success: false,
        error: 'Mentor not found' 
      });
    }

    // Get student's sessions with this mentor
    const sessions = await prisma.mentorSessions.findMany({
      where: { 
        mentorId: mentor.id,
        studentId: studentId
      },
      include: {
        student: {
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

    if (sessions.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Student not found or no sessions' 
      });
    }

    const student = sessions[0].student;

    res.json({ 
      success: true,
      student: {
        id: student.id,
        name: student.user?.displayName,
        email: student.user?.email,
        sessions: sessions.map(s => ({
          id: s.id,
          scheduled_at: s.scheduled_at,
          topic: s.topic,
          status: s.status,
          notes: s.notes
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching student details:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch student details' 
    });
  }
});

// ============================================
// AVAILABILITY
// ============================================

/**
 * GET /api/mentor/me/availability
 * Get mentor's availability slots
 */
router.get('/me/availability', authenticationMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const mentor = await prisma.mentors.findUnique({
      where: { user_id: userId },
      select: { 
        id: true,
        availability: true 
      }
    });

    if (!mentor) {
      return res.status(404).json({ 
        success: false,
        error: 'Mentor not found' 
      });
    }

    res.json({ 
      success: true,
      availability: mentor.availability || {} 
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch availability' 
    });
  }
});

/**
 * PUT /api/mentor/me/availability
 * Update mentor's availability
 */
router.put('/me/availability', authenticationMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { availability } = req.body;

    const mentor = await prisma.mentors.findUnique({
      where: { user_id: userId },
      select: { id: true }
    });

    if (!mentor) {
      return res.status(404).json({ 
        success: false,
        error: 'Mentor not found' 
      });
    }

    const updated = await prisma.mentors.update({
      where: { id: mentor.id },
      data: { availability }
    });

    res.json({ 
      success: true,
      message: 'Availability updated successfully',
      availability: updated.availability 
    });
  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update availability' 
    });
  }
});

// ============================================
// PUBLIC MENTOR ROUTES
// ============================================

/**
 * GET /api/mentor
 * Get all mentors (public)
 */
router.get('/', async (req, res) => {
  try {
    const { expertise } = req.query;

    const mentors = await prisma.mentors.findMany({
      where: expertise ? { 
        expertise: {
          contains: expertise,
          mode: 'insensitive'
        }
      } : undefined,
      include: {
        user: {
          select: { 
            id: true,
            displayName: true,
            email: true 
          }
        },
        _count: {
          select: { 
            sessions: true,
            reviews: true 
          }
        }
      },
      orderBy: { rating: 'desc' }
    });

    res.json({ 
      success: true,
      mentors 
    });
  } catch (error) {
    console.error('Error fetching mentors:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch mentors' 
    });
  }
});

/**
 * GET /api/mentor/:id
 * Get specific mentor profile (public)
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const mentor = await prisma.mentors.findUnique({
      where: { id },
      include: {
        user: {
          select: { 
            displayName: true,
            email: true 
          }
        },
        reviews: {
          include: {
            student: {
              include: {
                user: {
                  select: { displayName: true }
                }
              }
            }
          },
          orderBy: { created_at: 'desc' },
          take: 10
        },
        _count: {
          select: { sessions: true }
        }
      }
    });

    if (!mentor) {
      return res.status(404).json({ 
        success: false,
        error: 'Mentor not found' 
      });
    }

    res.json({ 
      success: true,
      mentor 
    });
  } catch (error) {
    console.error('Error fetching mentor:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch mentor' 
    });
  }
});

/**
 * POST /api/mentor/register
 * Register as a mentor (requires authentication)
 */
router.post('/register', authenticationMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { expertise, bio, experience } = req.body;

    // Check if already a mentor
    const existingMentor = await prisma.mentors.findUnique({
      where: { user_id: userId }
    });

    if (existingMentor) {
      return res.status(400).json({ 
        success: false,
        error: 'Already registered as mentor' 
      });
    }

    const mentor = await prisma.mentors.create({
      data: {
        user_id: userId,
        expertise: expertise || null,
        experience: experience || null,
        bio: bio || null,
        rating: 0
      },
      include: {
        user: {
          select: { 
            id: true,
            displayName: true,
            email: true 
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Mentor registration successful',
      mentor
    });
  } catch (error) {
    console.error('Error registering mentor:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to register as mentor' 
    });
  }
});

module.exports = router;
