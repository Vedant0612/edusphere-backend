// src/routes/applications.js
// ⚠️ DEPRECATED: This file is superseded by jobs.routes.js
// Consider migrating to the new routes or removing this file
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { ensureAuthenticated, restrictToRole } = require('../middleware/auth');
const whatsappService = require('../services/whatsapp.service');

const router = express.Router();
const prisma = new PrismaClient();

// APPLY TO INTERNSHIP (requires authentication)
router.post('/', ensureAuthenticated, async (req, res) => {
  try {
    const {
      student_id,
      internship_id,
      status,
      submission_url
    } = req.body;

    // Validate required fields
    if (!student_id || !internship_id) {
      return res.status(400).json({ error: 'student_id and internship_id are required' });
    }

    // Check if student exists
    const student = await prisma.profile.findUnique({
      where: { id: student_id }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    // Check if internship exists
    const internship = await prisma.internships.findUnique({
      where: { id: internship_id }
    });

    if (!internship) {
      return res.status(404).json({ error: 'Internship not found' });
    }

    // Check if already applied
    const existingApplication = await prisma.internship_applications.findFirst({
      where: {
        student_id,
        internship_id
      }
    });

    if (existingApplication) {
      return res.status(400).json({ error: 'Already applied to this internship' });
    }

    // Create application
    const application = await prisma.internship_applications.create({
      data: {
        student_id,
        internship_id,
        status: status || 'APPLIED',
        submission_url: submission_url || null,
        applied_at: new Date()
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
    console.error('Application creation error:', error);
    res.status(500).json({ error: 'Failed to submit application', details: error.message });
  }
});

// GET ALL APPLICATIONS (with filters)
router.get('/', async (req, res) => {
  try {
    const { studentId, internshipId, status } = req.query;

    const where = {};
    if (studentId) where.studentId = studentId;
    if (internshipId) where.internshipId = internshipId;
    if (status) where.status = status;

    const applications = await prisma.internshipApplication.findMany({
      where,
      include: {
        student: {
          include: {
            user: {
              select: {
                name: true,
                email: true
              }
            },
            profile: true
          }
        },
        internship: true
      },
      orderBy: {
        appliedAt: 'desc'
      }
    });

    res.json({ applications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// GET APPLICATION BY ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const application = await prisma.internshipApplication.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            user: true,
            profile: true
          }
        },
        internship: true
      }
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({ application });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// UPDATE APPLICATION STATUS (admin/industry only)
router.patch('/:id/status', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    const validStatuses = ['pending', 'accepted', 'rejected', 'withdrawn'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updateData = {
      status,
      reviewedAt: new Date()
    };

    if (status === 'rejected' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    const application = await prisma.internshipApplication.update({
      where: { id },
      data: updateData,
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                phoneNumber: true,  // ✅ Add this
                email: true
              }
            }
          }
        },
        internship: {
          select: {
            id: true,
            title: true,
            companyName: true,
            position: true
          }
        }
      }
    });

    // ============================================
    // 📱 SEND WHATSAPP NOTIFICATION
    // ============================================
    if (application.student?.user?.phoneNumber) {
      const phoneNumber = application.student.user.phoneNumber;
      const studentName = application.student.user.displayName;
      const companyName = application.internship.companyName;
      const position = application.internship.position || application.internship.title;

      // Create custom message based on status
      let message = '';
      
      if (status === 'accepted') {
        message = `🎉 Congratulations ${studentName}!

Your application for *${position}* at *${companyName}* has been *ACCEPTED*!

Next Steps:
✅ Check your dashboard for onboarding details
✅ You'll receive further instructions soon

Best of luck with your internship! 🚀

- Prashikshan Team`;
      } else if (status === 'rejected') {
        message = `Hi ${studentName},

We regret to inform you that your application for *${position}* at *${companyName}* was not successful this time.

${rejectionReason ? `Reason: ${rejectionReason}` : ''}

Don't lose hope! Keep applying to other opportunities. 💪

- Prashikshan Team`;
      } else if (status === 'pending') {
        message = `Hi ${studentName},

Your application for *${position}* at *${companyName}* is now under review.

We'll notify you once there's an update. 📋

- Prashikshan Team`;
      }

      // Send WhatsApp notification
      try {
        await whatsappService.notifyApplicationStatus(
          phoneNumber,
          studentName,
          companyName,
          status
        );
        console.log(`✅ WhatsApp notification sent to ${phoneNumber}`);
      } catch (whatsappError) {
        // Log error but don't fail the request
        console.error('❌ Failed to send WhatsApp notification:', whatsappError.message);
      }
    } else {
      console.log('⚠️ No phone number found for student, skipping WhatsApp notification');
    }

    res.json({
      message: `Application ${status}`,
      application
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update application' });
  }
});

// WITHDRAW APPLICATION (requires authentication)
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;

    const application = await prisma.internshipApplication.update({
      where: { id },
      data: {
        status: 'withdrawn'
      }
    });

    res.json({
      message: 'Application withdrawn',
      application
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to withdraw application' });
  }
});

module.exports = router;
