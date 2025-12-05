const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { ensureAuthenticated, restrictToRole } = require('../middleware/auth');
const { upload } = require('../middleware/uploads');
const { uploadOnCloudinary } = require('../services/cloudinary.service');

const prisma = new PrismaClient();

// CREATE LOGBOOK ENTRY (student only)
// Supports file upload for proof - if file present, uploads to Cloudinary
router.post('/', ensureAuthenticated, restrictToRole('student'), upload.any(), async (req, res) => {
  try {
    const { applicationId, date, taskDone, proofUrl, hours_spent } = req.body;
    const userId = req.user.id;

    if (!applicationId || !date || !taskDone || !hours_spent) {
      return res.status(400).json({
        error: 'applicationId, date, taskDone, and hours_spent are required'
      });
    }

    // Verify application belongs to student
    const application = await prisma.internship_applications.findUnique({
      where: { id: applicationId },
      include: {
        student: {
          select: { userId: true }
        }
      }
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.student.userId !== userId) {
      return res.status(403).json({ error: 'Not your application' });
    }

    // Handle file upload if present (proof)
    let uploadedProofUrl = proofUrl;
    const file = req.files && req.files.length > 0 ? req.files[0] : req.file;
    if (file) {
      try {
        uploadedProofUrl = await uploadOnCloudinary(file.path);
      } catch (uploadError) {
        console.error('Proof upload failed:', uploadError);
        return res.status(500).json({ error: 'Failed to upload proof file' });
      }
    }

    // Create logbook entry
    const entry = await prisma.logbook_entries.create({
      data: {
        applicationId,
        date: new Date(date),
        taskDone,
        proofUrl: uploadedProofUrl,
        hours_spent: parseInt(hours_spent),
        verifiedByFaculty: false
      }
    });

    res.status(201).json({
      message: 'Logbook entry created',
      entry
    });
  } catch (error) {
    console.error('Create logbook entry error:', error);
    res.status(500).json({ error: 'Failed to create logbook entry' });
  }
});

// GET MY LOGBOOK ENTRIES (student)
router.get('/my', ensureAuthenticated, restrictToRole('student'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { applicationId } = req.query;

    // Get student profile
    const profile = await prisma.profile.findUnique({
      where: { userId }
    });

    if (!profile) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    // Build query
    const where = {
      application: {
        student_id: profile.id
      }
    };

    if (applicationId) {
      where.applicationId = applicationId;
    }

    const entries = await prisma.logbook_entries.findMany({
      where,
      include: {
        application: {
          include: {
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
      orderBy: { date: 'desc' }
    });

    // Calculate stats
    const totalHours = entries.reduce((sum, entry) => sum + entry.hours_spent, 0);
    const verifiedCount = entries.filter(e => e.verifiedByFaculty).length;

    res.json({
      entries,
      stats: {
        totalEntries: entries.length,
        totalHours,
        verifiedEntries: verifiedCount,
        pendingVerification: entries.length - verifiedCount
      }
    });
  } catch (error) {
    console.error('Get my logbook error:', error);
    res.status(500).json({ error: 'Failed to fetch logbook entries' });
  }
});

// GET SINGLE LOGBOOK ENTRY (student owner)
router.get('/:entryId', ensureAuthenticated, async (req, res) => {
  try {
    const { entryId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const entry = await prisma.logbook_entries.findUnique({
      where: { id: entryId },
      include: {
        application: {
          include: {
            student: {
              select: {
                userId: true,
                user: {
                  select: {
                    displayName: true,
                    email: true
                  }
                }
              }
            },
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
      }
    });

    if (!entry) {
      return res.status(404).json({ error: 'Logbook entry not found' });
    }

    // Check access: student owner, faculty, or superAdmin
    const isOwner = entry.application.student.userId === userId;
    const isFaculty = userRole === 'faculty';
    const isSuperAdmin = userRole === 'superAdmin';

    if (!isOwner && !isFaculty && !isSuperAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ entry });
  } catch (error) {
    console.error('Get logbook entry error:', error);
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

// UPDATE LOGBOOK ENTRY (student owner, only if not verified)
// Supports file upload for proof - if file present, uploads to Cloudinary
router.put('/:entryId', ensureAuthenticated, restrictToRole('student'), upload.any(), async (req, res) => {
  try {
    const { entryId } = req.params;
    const { date, taskDone, proofUrl, hours_spent } = req.body;
    const userId = req.user.id;

    // Get entry and check ownership
    const entry = await prisma.logbook_entries.findUnique({
      where: { id: entryId },
      include: {
        application: {
          include: {
            student: {
              select: { userId: true }
            }
          }
        }
      }
    });

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    if (entry.application.student.userId !== userId) {
      return res.status(403).json({ error: 'Not your entry' });
    }

    if (entry.verifiedByFaculty) {
      return res.status(400).json({
        error: 'Cannot edit verified entry'
      });
    }

    // Handle file upload if present (proof)
    let uploadedProofUrl = proofUrl;
    const file = req.files && req.files.length > 0 ? req.files[0] : req.file;
    if (file) {
      try {
        uploadedProofUrl = await uploadOnCloudinary(file.path);
      } catch (uploadError) {
        console.error('Proof upload failed:', uploadError);
        return res.status(500).json({ error: 'Failed to upload proof file' });
      }
    }

    // Update entry
    const updateData = {};
    if (date) updateData.date = new Date(date);
    if (taskDone) updateData.taskDone = taskDone;
    if (uploadedProofUrl !== undefined) updateData.proofUrl = uploadedProofUrl;
    if (hours_spent) updateData.hours_spent = parseInt(hours_spent);

    const updatedEntry = await prisma.logbook_entries.update({
      where: { id: entryId },
      data: updateData
    });

    res.json({
      message: 'Entry updated',
      entry: updatedEntry
    });
  } catch (error) {
    console.error('Update logbook entry error:', error);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

// DELETE LOGBOOK ENTRY (student owner)
router.delete('/:entryId', ensureAuthenticated, restrictToRole('student'), async (req, res) => {
  try {
    const { entryId } = req.params;
    const userId = req.user.id;

    // Get entry and check ownership
    const entry = await prisma.logbook_entries.findUnique({
      where: { id: entryId },
      include: {
        application: {
          include: {
            student: {
              select: { userId: true }
            }
          }
        }
      }
    });

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    if (entry.application.student.userId !== userId) {
      return res.status(403).json({ error: 'Not your entry' });
    }

    // Delete entry
    await prisma.logbook_entries.delete({
      where: { id: entryId }
    });

    res.json({ message: 'Entry deleted' });
  } catch (error) {
    console.error('Delete logbook entry error:', error);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

// GET LOGBOOK ENTRIES FOR STUDENT (faculty/mentor view assigned students)
router.get('/student/:studentId', ensureAuthenticated, restrictToRole('faculty', 'mentor', 'superAdmin'), async (req, res) => {
  try {
    const { studentId } = req.params;
    const { applicationId, verified } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get student profile
    const student = await prisma.profile.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            displayName: true,
            email: true
          }
        },
        faculty: {
          select: {
            userId: true
          }
        }
      }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Check if faculty is assigned to this student
    if (userRole === 'faculty' && student.facultyId) {
      const faculty = await prisma.faculty.findUnique({
        where: { userId }
      });

      if (!faculty || student.facultyId !== faculty.id) {
        return res.status(403).json({ error: 'Not your assigned student' });
      }
    }

    // Build query
    const where = {
      application: {
        student_id: studentId
      }
    };

    if (applicationId) {
      where.applicationId = applicationId;
    }

    if (verified === 'true') {
      where.verifiedByFaculty = true;
    } else if (verified === 'false') {
      where.verifiedByFaculty = false;
    }

    const entries = await prisma.logbook_entries.findMany({
      where,
      include: {
        application: {
          include: {
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
      orderBy: { date: 'desc' }
    });

    res.json({
      student: {
        id: student.id,
        name: student.user.displayName,
        email: student.user.email
      },
      entries
    });
  } catch (error) {
    console.error('Get student logbook error:', error);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

// GET PENDING ENTRIES FOR FACULTY (faculty's assigned students)
router.get('/pending/faculty', ensureAuthenticated, restrictToRole('faculty'), async (req, res) => {
  try {
    const userId = req.user.id;

    // Get faculty profile
    const faculty = await prisma.faculty.findUnique({
      where: { userId },
      include: {
        students: {
          select: {
            id: true,
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

    if (!faculty) {
      return res.status(404).json({ error: 'Faculty profile not found' });
    }

    const studentIds = faculty.students.map(s => s.id);

    // Get pending entries for all assigned students
    const pendingEntries = await prisma.logbook_entries.findMany({
      where: {
        verifiedByFaculty: false,
        application: {
          student_id: { in: studentIds }
        }
      },
      include: {
        application: {
          include: {
            student: {
              select: {
                id: true,
                user: {
                  select: {
                    displayName: true,
                    email: true
                  }
                }
              }
            },
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
      orderBy: { date: 'desc' }
    });

    res.json({
      pendingCount: pendingEntries.length,
      entries: pendingEntries
    });
  } catch (error) {
    console.error('Get pending entries error:', error);
    res.status(500).json({ error: 'Failed to fetch pending entries' });
  }
});

// VERIFY LOGBOOK ENTRY (faculty/mentor assigned to student, or superAdmin)
router.patch('/:entryId/verify', ensureAuthenticated, restrictToRole('faculty', 'mentor', 'superAdmin'), async (req, res) => {
  try {
    const { entryId } = req.params;
    const { verified, comment } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (verified === undefined) {
      return res.status(400).json({ error: 'verified field (true/false) is required' });
    }

    // Get entry
    const entry = await prisma.logbook_entries.findUnique({
      where: { id: entryId },
      include: {
        application: {
          include: {
            student: {
              include: {
                faculty: {
                  select: {
                    userId: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    // Check if faculty/mentor is assigned to this student
    if (userRole === 'faculty') {
      const faculty = await prisma.faculty.findUnique({
        where: { userId }
      });

      if (!faculty || entry.application.student.facultyId !== faculty.id) {
        return res.status(403).json({ error: 'Not your assigned student' });
      }
    }

    // Update verification status
    const updatedEntry = await prisma.logbook_entries.update({
      where: { id: entryId },
      data: {
        verifiedByFaculty: verified,
        facultyComment: comment || null,
        verifiedAt: verified ? new Date() : null
      }
    });

    res.json({
      message: verified ? 'Entry verified' : 'Verification removed',
      entry: updatedEntry
    });
  } catch (error) {
    console.error('Verify entry error:', error);
    res.status(500).json({ error: 'Failed to verify entry' });
  }
});

// GET VERIFICATION HISTORY FOR ENTRY (all users who can view the entry)
router.get('/:entryId/verifications', ensureAuthenticated, async (req, res) => {
  try {
    const { entryId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const entry = await prisma.logbook_entries.findUnique({
      where: { id: entryId },
      include: {
        application: {
          include: {
            student: {
              select: {
                userId: true,
                facultyId: true
              }
            }
          }
        }
      }
    });

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    // Check access
    const isOwner = entry.application.student.userId === userId;
    const isSuperAdmin = userRole === 'superAdmin';
    
    let isAssignedFaculty = false;
    if (userRole === 'faculty') {
      const faculty = await prisma.faculty.findUnique({
        where: { userId }
      });
      isAssignedFaculty = faculty && entry.application.student.facultyId === faculty.id;
    }

    if (!isOwner && !isAssignedFaculty && !isSuperAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Return verification details
    res.json({
      verificationHistory: {
        verified: entry.verifiedByFaculty,
        comment: entry.facultyComment,
        verifiedAt: entry.verifiedAt
      }
    });
  } catch (error) {
    console.error('Get verification history error:', error);
    res.status(500).json({ error: 'Failed to fetch verification history' });
  }
});

module.exports = router;
