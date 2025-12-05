# Quick File Upload Guide

## How It Works

**All file uploads are handled automatically in existing routes!**

When you send a request with a file, the backend:
1. ✅ Detects the file
2. ✅ Uploads to Cloudinary
3. ✅ Stores the URL in database
4. ✅ Returns response with Cloudinary URL

---

## Endpoints Supporting File Upload

### 1. Student Profile Avatar
```bash
PATCH /students/:id/profile
Content-Type: multipart/form-data

avatar: [image file]  # Optional - auto-uploaded if present
bio: "Developer"
skills: ["React", "Node.js"]
```
**Database Field:** `profile.avatarURL`

---

### 2. Certificate Upload
```bash
POST /certifications/upload
Content-Type: multipart/form-data

certificate: [PDF/image file]  # Required
title: "AWS Certified"
issuer: "Amazon"
issueDate: "2024-01-15"
```
**Database Field:** `certificates.certificateUrl`

---

### 3. Company Logo
```bash
POST /companies
# or
PATCH /companies/:id
Content-Type: multipart/form-data

logo: [image file]  # Optional - auto-uploaded if present
companyName: "Tech Corp"
industry: "IT"
```
**Database Field:** `companies.logoUrl`

---

### 4. Logbook Proof
```bash
POST /logbook
# or
PUT /logbook/:entryId
Content-Type: multipart/form-data

proof: [image/document file]  # Optional - auto-uploaded if present
applicationId: "app-123"
taskDone: "Completed task"
hours_spent: 8
```
**Database Field:** `logbook_entries.proofUrl`

---

## Key Points

✅ **No separate upload endpoints** - files handled in main routes
✅ **Automatic detection** - backend checks if file is present
✅ **Cloudinary URLs** - all files stored on Cloudinary
✅ **Database storage** - URLs saved automatically
✅ **Flexible** - can send file or URL or both
✅ **Temp cleanup** - local files deleted after upload

---

## Example: Update Profile with Avatar

**JavaScript:**
```javascript
const formData = new FormData();
formData.append('avatar', fileInput.files[0]);
formData.append('bio', 'Software Developer');

const response = await fetch(`/students/${studentId}/profile`, {
  method: 'PATCH',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});

const data = await response.json();
console.log(data.profile.avatarURL); // Cloudinary URL
```

**cURL:**
```bash
curl -X PATCH http://localhost:8000/students/123/profile \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "avatar=@/path/to/image.jpg" \
  -F "bio=Software Developer"
```

---

## Supported File Types

- **Images:** jpg, jpeg, png, gif, bmp, webp, svg
- **Videos:** mp4, mov, avi, wmv, flv, mkv, webm
- **Documents:** pdf, doc, docx, and others

---

## Configuration

**Environment Variables:**
```env
CLOUDINARY_CLOUD_NAME=dxlzc9pbc
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
```

**Max File Size:** 10MB (configured in Multer)
**Temp Storage:** `public/temp` (auto-deleted after upload)
**Cloud Folder:** `edusphere_uploads`
