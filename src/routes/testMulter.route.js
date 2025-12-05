// routes/uploadRoute.js
const express = require('express');
const path = require('path');
const { upload } = require('../middleware/uploads');           // your multer (disk or memory)
const { uploadOnCloudinary } = require('../services/cloudinary.service');
const router = express.Router();

router.post('/upload', upload.any(), async (req, res) => {
  try {
    // Accept any field name
    const file = req.files && req.files.length > 0 ? req.files[0] : req.file;
    
    if (!file) return res.status(400).json({ error: 'No file uploaded. Use form-data with any field name.' });

    // If you're using diskStorage -> file.path exists
    // If using memoryStorage -> file.buffer exists (use stream upload instead)
    const localPath = file.path; // diskStorage path
    if (!localPath) return res.status(500).json({ error: 'Upload middleware not using diskStorage' });
console.log(localPath);

    const url = await uploadOnCloudinary(localPath);

    // OPTIONAL: save to DB (Prisma example)
    // await prisma.file.create({ data: { url, filename: file.originalname, mimeType: file.mimetype, size: file.size, provider: 'cloudinary' } });

    return res.json({ success: true, url, originalName: file.originalname });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

module.exports = router;
