// src/routes/internships.js
// ⚠️ DEPRECATED: This file is superseded by jobs.routes.js
// Consider migrating to the new routes or removing this file
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { ensureAuthenticated, restrictToRole } = require('../middleware/auth');
const twilio = require('twilio');

const router = express.Router();
const prisma = new PrismaClient();

// Initialize Twilio client
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Helper function to count matching skills
function countMatchingSkills(studentSkills, requiredSkills) {
  if (!studentSkills || !requiredSkills) return 0;
  
  // Normalize skills to lowercase for comparison
  const normalizedStudentSkills = studentSkills.map(skill => skill.toLowerCase().trim());
  const normalizedRequiredSkills = requiredSkills.map(skill => skill.toLowerCase().trim());
  
  return normalizedRequiredSkills.filter(skill => 
    normalizedStudentSkills.includes(skill)
  ).length;
}

// Helper function to format phone number to E.164 format
function formatPhoneNumber(phone) {
  if (!phone) return null;
  
  // Remove all spaces, dashes, and brackets
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // If already has +, return as is
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  
  // If starts with 91 (India country code), add +
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return '+' + cleaned;
  }
  
  // If 10 digits, assume Indian number and add +91
  if (cleaned.length === 10) {
    return '+91' + cleaned;
  }
  
  // Otherwise, return as is (might be invalid)
  return '+' + cleaned;
}

// Helper function to send SMS via Twilio
async function sendInternshipSMS(phoneNumber, internshipTitle, companyName, matchingSkillsCount) {
  if (!twilioClient || !TWILIO_PHONE_NUMBER) {
    console.log('Twilio not configured. SMS not sent.');
    return null;
  }

  // Format phone number to E.164
  const formattedPhone = formatPhoneNumber(phoneNumber);
  
  if (!formattedPhone) {
    console.log('Invalid phone number format');
    return null;
  }

  try {
    const message = await twilioClient.messages.create({
      body: `🎓 New Internship Alert!\n\n"${internshipTitle}" at ${companyName || 'Company'}\n\n✅ ${matchingSkillsCount} of your skills match!\n\nCheck the portal for details and apply now!`,
      from: TWILIO_PHONE_NUMBER,
      to: formattedPhone
    });
    
    return message;
  } catch (error) {
    console.error(`Failed to send SMS to ${formattedPhone}:`, error.message);
    return null;
  }
}

// CREATE INTERNSHIP (admin/industry only)
router.post('/', ensureAuthenticated, async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      stipend,
      location,
      required_skills,
      duration_weeks,
      industry_user_id
    } = req.body;

    // Validate required_skills is an array
    if (!Array.isArray(required_skills) || required_skills.length === 0) {
      return res.status(400).json({ error: 'required_skills must be a non-empty array' });
    }

    const internship = await prisma.internships.create({
      data: {
        title,
        description,
        type,
        stipend: stipend ? parseFloat(stipend) : null,
        location,
        required_skills: JSON.stringify(required_skills),
        duration_weeks: parseInt(duration_weeks),
        created_at: new Date(),
        industry_user_id
      }
    });

    // Get company name for SMS
    let companyName = 'Company';
    if (industry_user_id) {
      const company = await prisma.companies.findUnique({
        where: { userId: industry_user_id },
        select: { companyName: true }
      });
      companyName = company?.companyName || 'Company';
    }

    // Find students with matching skills (minimum 2 matches)
    const allStudents = await prisma.profile.findMany({
      where: {
        skills: {
          isEmpty: false // Only get students who have skills listed
        }
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            phone: true
          }
        }
      }
    });

    // Filter students with at least 2 matching skills
    const matchingStudents = allStudents.filter(student => {
      const matchCount = countMatchingSkills(student.skills, required_skills);
      return matchCount >= 2;
    });

    console.log(`Found ${matchingStudents.length} students with matching skills (minimum 2)`);

    // Send SMS notifications asynchronously (don't wait for completion)
    if (twilioClient && matchingStudents.length > 0) {
      // Send SMS in background without blocking response
      Promise.all(
        matchingStudents.map(async (student) => {
          if (!student.user.phone || student.user.phone.trim() === '') {
            console.log(`Skipping SMS for ${student.user.displayName} - no phone number`);
            return null;
          }

          const matchCount = countMatchingSkills(student.skills, required_skills);
          
          try {
            const result = await sendInternshipSMS(
              student.user.phone,
              title,
              companyName,
              matchCount
            );
            
            if (result) {
              console.log(`SMS sent to ${student.user.displayName} (${student.user.phone})`);
            }
            
            return result;
          } catch (error) {
            console.error(`Error sending SMS to ${student.user.displayName}:`, error);
            return null;
          }
        })
      ).then((results) => {
        const successCount = results.filter(r => r !== null).length;
        console.log(`SMS notification summary: ${successCount}/${matchingStudents.length} sent successfully`);
      }).catch(err => {
        console.error('Error in SMS batch sending:', err);
      });
    } else if (!twilioClient) {
      console.log('Twilio not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to .env');
    }

    res.status(201).json({
      message: 'Internship created',
      internship: {
        ...internship,
        required_skills: JSON.parse(internship.required_skills)
      },
      notificationsSent: twilioClient ? matchingStudents.length : 0,
      matchingStudents: matchingStudents.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create internship' });
  }
});




// GET ALL INTERNSHIPS (with filters)
router.get('/', async (req, res) => {
  try {
    const { location, type } = req.query;

    const where = {};
    
    if (location) where.location = { contains: location };
    if (type) where.type = type;

    const internships = await prisma.internships.findMany({
      where,
      include: {
        _count: {
          select: { applications: true }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Parse required_skills JSON if it's a string
    const formattedInternships = internships.map(internship => ({
      ...internship,
      required_skills: typeof internship.required_skills === 'string' 
        ? JSON.parse(internship.required_skills) 
        : internship.required_skills,
      applicationsCount: internship._count.applications
    }));

    res.json({ internships: formattedInternships });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch internships' });
  }
});

// GET INTERNSHIP BY ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const internship = await prisma.internships.findUnique({
      where: { id },
      include: {
        applications: {
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
        }
      }
    });

    if (!internship) {
      return res.status(404).json({ error: 'Internship not found' });
    }

    // Parse required_skills if it's a string
    if (typeof internship.required_skills === 'string') {
      internship.required_skills = JSON.parse(internship.required_skills);
    }

    res.json({ internship });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch internship' });
  }
});

// UPDATE INTERNSHIP (requires authentication)
router.put('/:id', ensureAuthenticated, restrictToRole('admin','company'), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Convert skills array to JSON string if it's an array
    if (updateData.required_skills && Array.isArray(updateData.required_skills)) {
      updateData.required_skills = JSON.stringify(updateData.required_skills);
    }

    // Parse duration_weeks to int if it exists
    if (updateData.duration_weeks) {
      updateData.duration_weeks = parseInt(updateData.duration_weeks);
    }

    // Parse stipend to float if it exists
    if (updateData.stipend) {
      updateData.stipend = parseFloat(updateData.stipend);
    }

    const internship = await prisma.internships.update({
      where: { id },
      data: updateData
    });

    // Parse required_skills for response if it's a string
    if (typeof internship.required_skills === 'string') {
      internship.required_skills = JSON.parse(internship.required_skills);
    }

    res.json({
      message: 'Internship updated',
      internship
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update internship' });
  }
});

// DELETE INTERNSHIP (admin only)
router.delete('/:id', ensureAuthenticated, restrictToRole('admin','company'), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.internships.delete({
      where: { id }
    });

    res.json({ message: 'Internship deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete internship' });
  }
});

module.exports = router;