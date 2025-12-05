const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { ensureAuthenticated, restrictToRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// ============================================
// JOB/INTERNSHIP LISTINGS
// ============================================

// GET ALL JOBS/INTERNSHIPS (public with filters)
router.get('/', async (req, res) => {
  try {
    const { location, type, skills, remote, stipendMin, companyId } = req.query;

    const where = { isActive: true };
    
    if (location) where.location = { contains: location, mode: 'insensitive' };
    if (type) where.type = type;
    if (companyId) where.company_id = companyId;
    if (stipendMin) where.stipend = { gte: parseFloat(stipendMin) };

    // Filter by skills (JSON contains)
    if (skills) {
      const skillsArray = skills.split(',');
      where.required_skills = {
        array_contains: skillsArray
      };
    }

    const jobs = await prisma.internships.findMany({
      where,
      include: {
        company: {
          select: {
            id: true,
            companyName: true,
            location: true,
            logoUrl: true
          }
        },
        _count: {
          select: { applications: true }
        }
      },
      orderBy: { created_at: 'desc' },
      take: 50
    });

    res.json({ 
      jobs,
      count: jobs.length
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// GET JOB BY ID (public)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const job = await prisma.internships.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            companyName: true,
            industry: true,
            website: true,
            description: true,
            location: true,
            logoUrl: true
          }
        },
        _count: {
          select: { applications: true }
        }
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ job });
  } catch (error) {
    console.error('Get job by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// ============================================
// JOB APPLICATIONS
// ============================================

// APPLY TO JOB (student only)
router.post('/:id/apply', ensureAuthenticated, restrictToRole('student'), async (req, res) => {
  try {
    const { id } = req.params;
    const { coverLetter, resumeUrl } = req.body;
    const userId = req.user.id;

    // Get student profile
    const profile = await prisma.profile.findUnique({
      where: { userId }
    });

    if (!profile) {
      return res.status(404).json({ error: 'Student profile not found. Please create your profile first.' });
    }

    // Check if job exists and is active
    const job = await prisma.internships.findUnique({
      where: { id }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (!job.isActive) {
      return res.status(400).json({ error: 'This job is no longer accepting applications' });
    }

    // Check if already applied
    const existingApplication = await prisma.internship_applications.findFirst({
      where: {
        internship_id: id,
        student_id: profile.id
      }
    });

    if (existingApplication) {
      return res.status(400).json({ error: 'You have already applied to this job' });
    }

    // Create application
    const application = await prisma.internship_applications.create({
      data: {
        internship_id: id,
        student_id: profile.id,
        status: 'APPLIED',
        submission_url: resumeUrl || null,
        applied_at: new Date()
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                displayName: true,
                email: true,
                phone: true
              }
            }
          }
        },
        internship: {
          include: {
            company: {
              select: {
                companyName: true
              }
            }
          }
        }
      }
    });

    res.status(201).json({
      message: 'Application submitted successfully',
      application
    });
  } catch (error) {
    console.error('Apply to job error:', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// GET APPLICATION BY ID (student owner, company owner, admin, superAdmin)
router.get('/applications/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const application = await prisma.internship_applications.findUnique({
      where: { id },
      include: {
        student: {
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
        },
        internship: {
          include: {
            company: {
              select: {
                id: true,
                userId: true,
                companyName: true
              }
            }
          }
        },
        logbookEntries: {
          orderBy: { date: 'desc' }
        },
        evaluations: {
          include: {
            faculty: {
              include: {
                user: {
                  select: {
                    displayName: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Check permissions
    const isStudent = application.student.userId === userId;
    const isCompany = application.internship.company?.userId === userId;
    const isSuperAdmin = userRole === 'superAdmin';
    
    let isInstituteAdmin = false;
    if (userRole === 'admin') {
      const adminInstitute = await prisma.institutions.findFirst({
        where: { adminUserId: userId }
      });
      isInstituteAdmin = adminInstitute && adminInstitute.id === application.student.instituteId;
    }

    if (!isStudent && !isCompany && !isInstituteAdmin && !isSuperAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ application });
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// UPDATE APPLICATION STATUS (company owner or superAdmin)
router.patch('/applications/:id/status', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    const validStatuses = ['APPLIED', 'SHORTLISTED', 'SELECTED', 'REJECTED'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status',
        validStatuses 
      });
    }

    // Get application with company info
    const application = await prisma.internship_applications.findUnique({
      where: { id },
      include: {
        internship: {
          include: {
            company: {
              select: {
                userId: true
              }
            }
          }
        }
      }
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Check permissions
    const isCompanyOwner = application.internship.company?.userId === userId;
    const isSuperAdmin = userRole === 'superAdmin';

    if (!isCompanyOwner && !isSuperAdmin) {
      return res.status(403).json({ error: 'Forbidden - Only job poster can update status' });
    }

    // Update status
    const updatedApplication = await prisma.internship_applications.update({
      where: { id },
      data: { status }
    });

    res.json({
      message: `Application status updated to ${status}`,
      application: updatedApplication
    });
  } catch (error) {
    console.error('Update application status error:', error);
    res.status(500).json({ error: 'Failed to update application' });
  }
});

// WITHDRAW APPLICATION (student owner)
router.delete('/applications/:id', ensureAuthenticated, restrictToRole('student'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get application
    const application = await prisma.internship_applications.findUnique({
      where: { id },
      include: {
        student: {
          select: { userId: true }
        }
      }
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Check ownership
    if (application.student.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden - Not your application' });
    }

    // Update to rejected/withdrawn status instead of deleting
    await prisma.internship_applications.update({
      where: { id },
      data: { status: 'REJECTED' }
    });

    res.json({ message: 'Application withdrawn' });
  } catch (error) {
    console.error('Withdraw application error:', error);
    res.status(500).json({ error: 'Failed to withdraw application' });
  }
});

// SCHEDULE INTERVIEW (company owner or superAdmin) - Placeholder
router.post('/applications/:id/schedule-interview', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { interviewDate, meetingLink, notes } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get application
    const application = await prisma.internship_applications.findUnique({
      where: { id },
      include: {
        internship: {
          include: {
            company: {
              select: {
                userId: true,
                companyName: true
              }
            }
          }
        },
        student: {
          include: {
            user: {
              select: {
                email: true,
                displayName: true
              }
            }
          }
        }
      }
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Check permissions
    const isCompanyOwner = application.internship.company?.userId === userId;
    const isSuperAdmin = userRole === 'superAdmin';

    if (!isCompanyOwner && !isSuperAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // TODO: Implement calendar integration and email notifications
    console.log(`Interview scheduled for ${application.student.user.displayName}`);
    console.log(`Date: ${interviewDate}, Link: ${meetingLink}`);

    res.json({
      message: 'Interview scheduled successfully',
      interview: {
        applicationId: id,
        studentName: application.student.user.displayName,
        studentEmail: application.student.user.email,
        companyName: application.internship.company.companyName,
        interviewDate,
        meetingLink,
        notes
      }
    });
  } catch (error) {
    console.error('Schedule interview error:', error);
    res.status(500).json({ error: 'Failed to schedule interview' });
  }
});

// CREATE OFFER LETTER (company owner or superAdmin) - Placeholder
router.post('/applications/:id/offer', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { offerDetails, salary, startDate } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get application
    const application = await prisma.internship_applications.findUnique({
      where: { id },
      include: {
        internship: {
          include: {
            company: {
              select: {
                userId: true
              }
            }
          }
        }
      }
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Check permissions
    const isCompanyOwner = application.internship.company?.userId === userId;
    const isSuperAdmin = userRole === 'superAdmin';

    if (!isCompanyOwner && !isSuperAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Update application to SELECTED
    await prisma.internship_applications.update({
      where: { id },
      data: { status: 'SELECTED' }
    });

    // TODO: Generate offer letter PDF and send email
    res.json({
      message: 'Offer letter created',
      offer: {
        applicationId: id,
        offerDetails,
        salary,
        startDate
      }
    });
  } catch (error) {
    console.error('Create offer error:', error);
    res.status(500).json({ error: 'Failed to create offer' });
  }
});

module.exports = router;
