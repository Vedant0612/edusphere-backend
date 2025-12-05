const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { ensureAuthenticated, restrictToRole, ensureOwnership } = require('../middleware/auth');
const { upload } = require('../middleware/uploads');
const { uploadOnCloudinary } = require('../services/cloudinary.service');

const prisma = new PrismaClient();

// REGISTER COMPANY (public self-registration)
// Supports file upload for logo - if file present, uploads to Cloudinary
router.post('/', upload.any(), async (req, res) => {
  try {
    const { userId, companyName, industry, website, description, location, logoUrl } = req.body;

    if (!userId || !companyName) {
      return res.status(400).json({ error: 'userId and companyName are required' });
    }

    // Verify user exists and has company role
    const user = await prisma.users.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role !== 'company') {
      return res.status(403).json({ error: 'User must have company role' });
    }

    // Check if company profile already exists
    const existingCompany = await prisma.companies.findUnique({
      where: { userId }
    });

    if (existingCompany) {
      return res.status(400).json({ error: 'Company profile already exists' });
    }

    // Handle file upload if present (logo)
    let uploadedLogoUrl = logoUrl;
    const file = req.files && req.files.length > 0 ? req.files[0] : req.file;
    if (file) {
      try {
        uploadedLogoUrl = await uploadOnCloudinary(file.path);
      } catch (uploadError) {
        console.error('Logo upload failed:', uploadError);
        return res.status(400).json({ error: 'Failed to upload logo image' });
      }
    }

    // Create company profile
    const company = await prisma.companies.create({
      data: {
        userId,
        companyName,
        industry,
        website,
        description,
        location,
        logoUrl: uploadedLogoUrl
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Company registered successfully',
      company
    });
  } catch (error) {
    console.error('Company registration error:', error);
    res.status(500).json({ error: 'Failed to register company' });
  }
});

// GET COMPANY BY ID (public)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const company = await prisma.companies.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            email: true,
            displayName: true
          }
        },
        jobPostings: {
          where: { isActive: true },
          select: {
            id: true,
            title: true,
            type: true,
            location: true,
            stipend: true,
            created_at: true
          }
        },
        _count: {
          select: { jobPostings: true }
        }
      }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({ company });
  } catch (error) {
    console.error('Get company error:', error);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// GET MY COMPANY PROFILE (authenticated company user)
router.get('/me/profile', ensureAuthenticated, restrictToRole('company'), async (req, res) => {
  try {
    const userId = req.user.id;

    const company = await prisma.companies.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            phone: true
          }
        },
        jobPostings: {
          include: {
            _count: {
              select: { applications: true }
            }
          },
          orderBy: { created_at: 'desc' }
        }
      }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company profile not found' });
    }

    res.json({ company });
  } catch (error) {
    console.error('Get my company error:', error);
    res.status(500).json({ error: 'Failed to fetch company profile' });
  }
});

// UPDATE COMPANY PROFILE (owner or superAdmin)
// Supports file upload for logo - if file present, uploads to Cloudinary
router.patch('/:id', ensureAuthenticated, upload.any(), async (req, res) => {
  try {
    const { id } = req.params;
    const { companyName, industry, website, description, location, logoUrl } = req.body;
    const userRole = req.user.role;
    const userId = req.user.id;

    // Get company to check ownership
    const company = await prisma.companies.findUnique({
      where: { id }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check permissions
    if (userRole !== 'superAdmin' && company.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden - Not your company' });
    }

    // Handle file upload if present (logo)
    let uploadedLogoUrl = logoUrl;
    const file = req.files && req.files.length > 0 ? req.files[0] : req.file;
    if (file) {
      try {
        uploadedLogoUrl = await uploadOnCloudinary(file.path);
      } catch (uploadError) {
        console.error('Logo upload failed:', uploadError);
        return res.status(500).json({ error: 'Failed to upload logo image' });
      }
    }

    // Update company
    const updatedCompany = await prisma.companies.update({
      where: { id },
      data: {
        companyName,
        industry,
        website,
        description,
        location,
        logoUrl: uploadedLogoUrl
      }
    });

    res.json({
      message: 'Company profile updated',
      company: updatedCompany
    });
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

// CREATE JOB POSTING (company owner or superAdmin)
router.post('/:id/postings', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      type,
      stipend,
      location,
      required_skills,
      duration_weeks
    } = req.body;
    const userRole = req.user.role;
    const userId = req.user.id;

    // Get company to check ownership
    const company = await prisma.companies.findUnique({
      where: { id }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check permissions
    if (userRole !== 'superAdmin' && company.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden - Not your company' });
    }

    // Create internship/job posting
    const posting = await prisma.internships.create({
      data: {
        title,
        description,
        type,
        stipend: stipend ? parseFloat(stipend) : null,
        location,
        required_skills: required_skills || [],
        duration_weeks: parseInt(duration_weeks),
        industry_user_id: userId,
        company_id: id,
        created_at: new Date(),
        isActive: true
      }
    });

    res.status(201).json({
      message: 'Job posting created',
      posting
    });
  } catch (error) {
    console.error('Create posting error:', error);
    res.status(500).json({ error: 'Failed to create job posting' });
  }
});

// GET COMPANY JOB POSTINGS
router.get('/:id/jobs', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.query;

    const where = { company_id: id };
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;

    const jobs = await prisma.internships.findMany({
      where,
      include: {
        _count: {
          select: { applications: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json({ jobs });
  } catch (error) {
    console.error('Get company jobs error:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// UPDATE JOB POSTING (company owner or superAdmin)
router.patch('/:id/postings/:jobId', ensureAuthenticated, async (req, res) => {
  try {
    const { id, jobId } = req.params;
    const updateData = req.body;
    const userRole = req.user.role;
    const userId = req.user.id;

    // Get company to check ownership
    const company = await prisma.companies.findUnique({
      where: { id }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check permissions
    if (userRole !== 'superAdmin' && company.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden - Not your company' });
    }

    // Verify job belongs to this company
    const job = await prisma.internships.findUnique({
      where: { id: jobId }
    });

    if (!job || job.company_id !== id) {
      return res.status(404).json({ error: 'Job not found or does not belong to this company' });
    }

    // Update job
    const updatedJob = await prisma.internships.update({
      where: { id: jobId },
      data: updateData
    });

    res.json({
      message: 'Job posting updated',
      job: updatedJob
    });
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

// DELETE/DEACTIVATE JOB POSTING (company owner or superAdmin)
router.delete('/:id/postings/:jobId', ensureAuthenticated, async (req, res) => {
  try {
    const { id, jobId } = req.params;
    const userRole = req.user.role;
    const userId = req.user.id;

    // Get company to check ownership
    const company = await prisma.companies.findUnique({
      where: { id }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check permissions
    if (userRole !== 'superAdmin' && company.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden - Not your company' });
    }

    // Soft delete: deactivate the job
    await prisma.internships.update({
      where: { id: jobId },
      data: { isActive: false }
    });

    res.json({ message: 'Job posting deactivated' });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

// GET APPLICANTS FOR COMPANY (company owner or superAdmin)
router.get('/:id/applicants', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { jobId, status } = req.query;
    const userRole = req.user.role;
    const userId = req.user.id;

    // Get company to check ownership
    const company = await prisma.companies.findUnique({
      where: { id }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check permissions
    if (userRole !== 'superAdmin' && company.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden - Not your company' });
    }

    // Build query
    const where = {
      internship: { company_id: id }
    };

    if (jobId) where.internship_id = jobId;
    if (status) where.status = status;

    const applicants = await prisma.internship_applications.findMany({
      where,
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
            }
          }
        },
        internship: {
          select: {
            id: true,
            title: true,
            type: true
          }
        }
      },
      orderBy: { applied_at: 'desc' }
    });

    res.json({ applicants });
  } catch (error) {
    console.error('Get applicants error:', error);
    res.status(500).json({ error: 'Failed to fetch applicants' });
  }
});

// INVITE STUDENT FOR INTERVIEW (company owner or superAdmin)
router.post('/:id/invite', ensureAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId, jobId, message, interviewDate } = req.body;
    const userRole = req.user.role;
    const userId = req.user.id;

    // Get company to check ownership
    const company = await prisma.companies.findUnique({
      where: { id }
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check permissions
    if (userRole !== 'superAdmin' && company.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden - Not your company' });
    }

    // TODO: Create notification/email system for interview invites
    // For now, just log the invite
    console.log(`Interview invite sent to student ${studentId} for job ${jobId}`);
    console.log(`Message: ${message}`);
    console.log(`Interview Date: ${interviewDate}`);

    res.json({
      message: 'Interview invitation sent',
      studentId,
      jobId,
      interviewDate
    });
  } catch (error) {
    console.error('Send invite error:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

module.exports = router;
