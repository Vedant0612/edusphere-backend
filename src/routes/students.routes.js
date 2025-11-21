const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { ensureAuthenticated } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// router.use(ensureAuthenticated);

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

// CREATE STUDENT PROFILE
router.post('/', async (req, res) => {
  try {
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
    } = req.body;

    if (!userId || !instituteId) {
      return res.status(400).json({
        error: 'userId and instituteId are required fields.',
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

    const profile = await prisma.profile.create({
      data: {
        userId,
        instituteId,
        facultyId,
        bio,
        gender,
        DOB: DOB ? new Date(DOB) : null,
        avatarURL,
        github,
        linkedin,
        skills: toStringArray(skills),
        interests: toStringArray(interests),
        department,
        resourceId,
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

// UPDATE STUDENT PROFILE
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (updateData.DOB) {
      updateData.DOB = new Date(updateData.DOB);
    }

    if (updateData.skills !== undefined) {
      updateData.skills = toStringArray(updateData.skills);
    }

    if (updateData.interests !== undefined) {
      updateData.interests = toStringArray(updateData.interests);
    }

    const profile = await prisma.profile.update({
      where: { id },
      data: updateData,
      include: {
        user: true,
        institution: true,
        faculty: true,
      },
    });

    res.json({ message: 'Student profile updated', profile });
  } catch (error) {
    console.error(error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Student profile not found' });
    }
    res.status(500).json({ error: 'Failed to update student profile' });
  }
});

// UPDATE PROFILE DETAILS (PARTIAL)
router.post('/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;
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

    const profile = await prisma.profile.update({
      where: { id },
      data: {
        bio,
        gender,
        DOB: DOB ? new Date(DOB) : undefined,
        avatarURL,
        github,
        linkedin,
        skills: skills !== undefined ? toStringArray(skills) : undefined,
        interests: interests !== undefined ? toStringArray(interests) : undefined,
        department,
        resourceId,
        instituteId,
        facultyId,
      },
      include: {
        user: true,
        institution: true,
        faculty: true,
      },
    });

    res.json({ message: 'Profile details updated', profile });
  } catch (error) {
    console.error(error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Student profile not found' });
    }
    res.status(500).json({ error: 'Failed to update profile details' });
  }
});

module.exports = router;