// src/routes/internships.js
// ⚠️ DEPRECATED: This file is superseded by jobs.routes.js
// ⚠️ NOTE: Most internship CRUD functionality has been moved to /api/jobs route
// ⚠️ This file is kept for backwards compatibility with SMS notification feature
// ⚠️ Consider using /api/jobs for new implementations
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticationMiddleware, ensureAuthenticated, restrictToRole } = require('../middleware/auth');
const twilio = require('twilio');

const router = express.Router();
const prisma = new PrismaClient();

// Initialize Twilio client
// Initialize Twilio clients
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const twilioWhatsAppClient = process.env.TWILIO_WHATSAPP_ACCOUNT_SID && process.env.TWILIO_WHATSAPP_AUTH_TOKEN
  ? twilio(process.env.TWILIO_WHATSAPP_ACCOUNT_SID, process.env.TWILIO_WHATSAPP_AUTH_TOKEN)
  : null;

const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;

// Helper function to count matching skills
function countMatchingSkills(studentSkills, requiredSkills) {
  if (!studentSkills || !requiredSkills) return 0;
  
  const normalizedStudentSkills = studentSkills.map(skill => skill.toLowerCase().trim());
  const normalizedRequiredSkills = requiredSkills.map(skill => skill.toLowerCase().trim());
  
  return normalizedRequiredSkills.filter(skill => 
    normalizedStudentSkills.includes(skill)
  ).length;
}

// Helper function to format phone number to E.164 format
function formatPhoneNumber(phone) {
  if (!phone) return null;
  
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return '+' + cleaned;
  }
  
  if (cleaned.length === 10) {
    return '+91' + cleaned;
  }
  
  return '+' + cleaned;
}

// Helper function to send SMS via Twilio
async function sendInternshipSMS(phoneNumber, internshipTitle, companyName, matchingSkillsCount) {
  if (!twilioClient || !TWILIO_PHONE_NUMBER) {
    console.log('Twilio not configured. SMS not sent.');
    return null;
  }

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

// Helper function to send WhatsApp via Twilio
// Helper function to send WhatsApp via Twilio
async function sendInternshipWhatsApp(phoneNumber, internshipTitle, companyName, matchingSkillsCount) {
  if (!twilioWhatsAppClient || !TWILIO_WHATSAPP_NUMBER) {
    console.log('Twilio WhatsApp not configured.');
    return null;
  }

  const formattedPhone = formatPhoneNumber(phoneNumber);
  
  if (!formattedPhone) {
    console.log('Invalid phone number format');
    return null;
  }

  // Format WhatsApp numbers correctly
  const fromNumber = TWILIO_WHATSAPP_NUMBER.startsWith('whatsapp:') 
    ? TWILIO_WHATSAPP_NUMBER 
    : `whatsapp:${TWILIO_WHATSAPP_NUMBER}`;
  
  const toNumber = `whatsapp:${formattedPhone}`;

  try {
    const message = await twilioWhatsAppClient.messages.create({
      body: `🎓 *New Internship Alert!*\n\n"${internshipTitle}" at ${companyName || 'Company'}\n\n✅ ${matchingSkillsCount} of your skills match!\n\nCheck the portal for details and apply now!`,
      from: fromNumber,
      to: toNumber
    });
    
    console.log(`✅ WhatsApp sent to ${phoneNumber}`);
    return message;
  } catch (error) {
    console.error(`❌ Failed to send WhatsApp to ${toNumber}:`, error.message);
    return null;
  }
}

// Helper function to send WhatsApp update notification
// Helper function to send WhatsApp update notification
async function sendWhatsAppUpdate(phoneNumber, internshipTitle, companyName) {
  if (!twilioWhatsAppClient || !TWILIO_WHATSAPP_NUMBER) {
    console.log('Twilio WhatsApp not configured.');
    return null;
  }

  const formattedPhone = formatPhoneNumber(phoneNumber);
  
  if (!formattedPhone) {
    console.log('Invalid phone number format');
    return null;
  }

  // Format WhatsApp numbers correctly
  const fromNumber = TWILIO_WHATSAPP_NUMBER.startsWith('whatsapp:') 
    ? TWILIO_WHATSAPP_NUMBER 
    : `whatsapp:${TWILIO_WHATSAPP_NUMBER}`;
  
  const toNumber = `whatsapp:${formattedPhone}`;

  try {
    const message = await twilioWhatsAppClient.messages.create({
      body: `🔔 *Internship Update Alert!*\n\n"${internshipTitle}" at ${companyName || 'Company'} has been updated!\n\nCheck the portal for latest details!`,
      from: fromNumber,
      to: toNumber
    });
    
    console.log(`✅ WhatsApp update sent to ${phoneNumber}`);
    return message;
  } catch (error) {
    console.error(`❌ Failed to send WhatsApp to ${toNumber}:`, error.message);
    return null;
  }
}
// CREATE INTERNSHIP (admin/industry only)
router.post('/', authenticationMiddleware, ensureAuthenticated, restrictToRole('admin', 'company'), async (req, res) => {
  try {
    // Debug: Check if user is authenticated
    console.log('🔍 Authenticated user:', {
      id: req.user.id,
      role: req.user.role,
      email: req.user.email
    });
    
    if (!req.user || !req.user.id) {
      return res.status(401).json({ 
        error: 'User not authenticated or user ID missing'
      });
    }

    const {
      title,
      description,
      type,
      stipend,
      location,
      required_skills,
      duration_weeks
    } = req.body;

    // Use authenticated user's ID
    const industry_user_id = req.user.id;

    console.log('📥 Creating internship:', {
      title,
      type,
      industry_user_id,
      userRole: req.user.role,
      userEmail: req.user.email
    });

    // Validate required fields
    if (!title || !description || !type || !location || !duration_weeks) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['title', 'description', 'type', 'location', 'duration_weeks', 'required_skills']
      });
    }

    // Validate required_skills is an array
    if (!Array.isArray(required_skills) || required_skills.length === 0) {
      return res.status(400).json({ error: 'required_skills must be a non-empty array' });
    }

    // Get company_id and name for the authenticated user
    let company_id = null;
    let companyName = 'Company';
    
    try {
      const company = await prisma.companies.findUnique({
        where: { userId: industry_user_id },
        select: { id: true, companyName: true }
      });
      
      if (company) {
        company_id = company.id;
        companyName = company.companyName;
        console.log(`✅ Found company: ${companyName} (${company_id})`);
      } else {
        console.log('⚠️  No company profile found for this user');
      }
    } catch (err) {
      console.log('⚠️  Error fetching company:', err.message);
    }

    // Create internship
    const internship = await prisma.internships.create({
      data: {
        title,
        description,
        type,
        stipend: stipend ? parseFloat(stipend) : null,
        location,
        required_skills: required_skills, // Prisma handles JSON automatically
        duration_weeks: parseInt(duration_weeks),
        created_at: new Date(),
        industry_user_id,
        company_id,
        isActive: true
      }
    });

    console.log('✅ Internship created:', internship.id);
    //here i want to send a message saying internship created 
    console.log('✅ Internship created:', internship.id);

// Send simple WhatsApp confirmation
if (twilioWhatsAppClient && TWILIO_WHATSAPP_NUMBER) {
  try {
    const fromNumber = TWILIO_WHATSAPP_NUMBER.startsWith('whatsapp:') 
      ? TWILIO_WHATSAPP_NUMBER 
      : `whatsapp:${TWILIO_WHATSAPP_NUMBER}`;

    await twilioWhatsAppClient.messages.create({
      body: `✅ Internship "${title}" created successfully!`,
      from: fromNumber,
      to: `whatsapp:+918921811139`  // Replace with your phone number
    });
    
    console.log('✅ WhatsApp confirmation sent');
  } catch (error) {
    console.error('❌ WhatsApp failed:', error.message);
  }
}


    // Find students with matching skills (minimum 2 matches)
    const allStudents = await prisma.profile.findMany({
      where: {
        skills: {
          isEmpty: false
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

    // Send notifications asynchronously
    if (matchingStudents.length > 0) {
      Promise.all(
        matchingStudents.map(async (student) => {
          if (!student.user.phone || student.user.phone.trim() === '') {
            console.log(`⏭️  Skipping notifications for ${student.user.displayName} - no phone number`);
            return { sms: null, whatsapp: null };
          }

          const matchCount = countMatchingSkills(student.skills, required_skills);
          
          // Send SMS
          let smsResult = null;
          if (twilioClient) {
            try {
              smsResult = await sendInternshipSMS(
                student.user.phone,
                title,
                companyName,
                matchCount
              );
              
              if (smsResult) {
                console.log(`✅ SMS sent to ${student.user.displayName}`);
              }
            } catch (error) {
              console.error(`❌ SMS error for ${student.user.displayName}:`, error.message);
            }
          }

          // Send WhatsApp
          let whatsappResult = null;
          try {
            whatsappResult = await sendInternshipWhatsApp(
              student.user.phone,
              title,
              companyName,
              matchCount
            );
            
            if (whatsappResult) {
              console.log(`✅ WhatsApp sent to ${student.user.displayName}`);
            }
          } catch (error) {
            console.error(`❌ WhatsApp error for ${student.user.displayName}:`, error.message);
          }
          
          return { sms: smsResult, whatsapp: whatsappResult };
        })
      ).then((results) => {
        const smsSuccess = results.filter(r => r.sms !== null).length;
        const whatsappSuccess = results.filter(r => r.whatsapp !== null).length;
        console.log(`📊 Notification summary:`);
        console.log(`   📱 SMS: ${smsSuccess}/${matchingStudents.length} sent`);
        console.log(`   💬 WhatsApp: ${whatsappSuccess}/${matchingStudents.length} sent`);
      }).catch(err => {
        console.error('❌ Error in notification batch sending:', err);
      });
    }

    res.status(201).json({
      message: 'Internship created successfully',
      internship: {
        ...internship,
        required_skills: internship.required_skills
      },
      notifications: {
        smsAttempted: twilioClient ? matchingStudents.length : 0,
        whatsappAttempted: matchingStudents.length,
        matchingStudents: matchingStudents.length
      }
    });

  } catch (error) {
    console.error('❌ Error creating internship:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    
    res.status(500).json({ 
      error: 'Failed to create internship',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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
        company: {
          select: {
            companyName: true,
            description: true,
            logoUrl: true,
            location: true
          }
        },
        _count: {
          select: { applications: true }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    const formattedInternships = internships.map(internship => ({
      ...internship,
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
        company: {
          select: {
            companyName: true,
            description: true,
            logoUrl: true,
            location: true
          }
        },
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

    res.json({ internship });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch internship' });
  }
});

// UPDATE INTERNSHIP (requires authentication)
router.put('/:id', authenticationMiddleware, ensureAuthenticated, restrictToRole('admin','company'), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

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
router.delete('/:id', authenticationMiddleware, ensureAuthenticated, restrictToRole('admin','company'), async (req, res) => {
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