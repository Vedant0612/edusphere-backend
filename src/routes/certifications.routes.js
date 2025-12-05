const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { ensureAuthenticated } = require('../middleware/auth');
const { upload } = require('../middleware/uploads');
const { uploadOnCloudinary } = require('../services/cloudinary.service');
const pdfService = require('../services/pdf.service');
const aiService = require('../services/ai.service');

const router = express.Router();
const prisma = new PrismaClient();


// Upload certificate with file - file is required
router.post('/upload', ensureAuthenticated, upload.any(), async (req, res) => {
  const userId = req.user.id;
  
  // Accept any field name
  const file = req.files && req.files.length > 0 ? req.files[0] : req.file;

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded. Please include a certificate file.' });
  }

  try {
    // Get student profile
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { id: true }
    });

    if (!profile) {
      return res.status(400).json({ error: 'Student profile not found' });
    }

    // Upload to Cloudinary
    const certificateUrl = await uploadOnCloudinary(file.path);

    let certData = {
      title: req.body.title || 'Untitled Certificate',
      issuer: req.body.issuer || null,
      issuedAt: req.body.issueDate ? new Date(req.body.issueDate) : new Date(),
      certificateUrl
    };

    // If PDF, try to extract information using AI
    if (file.mimetype === 'application/pdf') {
      try {
        const pdfText = await pdfService.extractText(file.path);
        const extracted = await aiService.extractCertificationFromPDF(pdfText);
        
        if (extracted) {
          certData = {
            ...certData,
            title: extracted.title || certData.title,
            issuer: extracted.issuer || certData.issuer,
            issuedAt: extracted.issueDate ? new Date(extracted.issueDate) : certData.issuedAt
          };
        }
      } catch (error) {
        console.log('PDF extraction failed, using manual data:', error.message);
      }
    }

    const certificate = await prisma.certificates.create({
      data: {
        student_id: profile.id,
        ...certData
      }
    });

    res.json({
      success: true,
      message: 'Certificate uploaded successfully',
      certificate,
      certificateUrl
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all certifications
router.get('/', ensureAuthenticated, async (req, res) => {
  const userId = req.user.id;

  try {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { id: true }
    });

    if (!profile) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    const certificates = await prisma.certificates.findMany({
      where: { student_id: profile.id },
      orderBy: { issuedAt: 'desc' }
    });

    res.json({ certificates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update certification
router.put('/:id', ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { id: true }
    });

    const certificate = await prisma.certificates.findFirst({
      where: {
        id: id,
        student_id: profile.id
      }
    });

    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    const updated = await prisma.certificates.update({
      where: { id: id },
      data: {
        title: req.body.title,
        issuer: req.body.issuer,
        issuedAt: req.body.issuedAt ? new Date(req.body.issuedAt) : undefined
      }
    });

    res.json({ success: true, certificate: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete certification
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { id: true }
    });

    const certificate = await prisma.certificates.findFirst({
      where: {
        id: id,
        student_id: profile.id
      }
    });

    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    await prisma.certificates.delete({
      where: { id: id }
    });

    res.json({ success: true, message: 'Certificate deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
