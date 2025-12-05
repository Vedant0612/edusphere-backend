# File Upload Integration - Cloudinary

All file uploads are automatically handled within existing routes. When you include a file in your request, it's uploaded to Cloudinary and the URL is stored in the database.

## Upload Flow
1. **Client** → Sends file via multipart/form-data along with other data
2. **Multer** → Temporarily saves to `public/temp` directory
3. **Route Handler** → Detects file presence
4. **Cloudinary Service** → Uploads to Cloudinary cloud storage
5. **Database** → Stores the Cloudinary URL
6. **Temp File** → Automatically deleted

## How It Works

**No separate upload endpoints needed!** Just include the file in your existing POST/PATCH requests.

The routes automatically:
- Detect if a file is present in the request
- Upload it to Cloudinary if found
- Use the Cloudinary URL in the database
- Fall back to URL from body if no file is uploaded

### 1. Update Student Profile (with Avatar)
**Endpoint:** `PATCH /students/:id/profile`  
**Auth Required:** Yes (Student must be profile owner)  
**File Support:** Yes - automatically uploads to Cloudinary if file included
**Database Field:** `profile.avatarURL`

**Request with file:**
```bash
PATCH /students/123/profile
Content-Type: multipart/form-data

avatar: [image file]  # File automatically uploaded to Cloudinary
bio: "Software Developer"
skills: ["JavaScript", "React"]
```

**Request without file (just update other fields):**
```bash
PATCH /students/123/profile
Content-Type: application/json

{
  "bio": "Software Developer",
  "skills": ["JavaScript", "React"]
}
```

**Response:**
```json
{
  "message": "Profile details updated",
  "profile": {
    "id": "123",
    "avatarURL": "https://res.cloudinary.com/dxlzc9pbc/image/upload/v123/edusphere_uploads/avatar.jpg",
    "bio": "Software Developer",
    ...
  }
}
```

---

### 2. Upload Certificate
**Endpoint:** `POST /certifications/upload`  
**Auth Required:** Yes (Student only)  
**File Support:** Yes - **file is required** (automatically uploaded to Cloudinary)
**Database Field:** `certificates.certificateUrl`

**Request:**
```bash
POST /certifications/upload
Content-Type: multipart/form-data

certificate: [PDF/image file]  # Required - automatically uploaded
title: "AWS Certified Developer"
issuer: "Amazon Web Services"
issueDate: "2024-01-15"
```

**Response:**
```json
{
  "success": true,
  "message": "Certificate uploaded successfully",
  "certificateUrl": "https://res.cloudinary.com/dxlzc9pbc/raw/upload/v123/edusphere_uploads/cert.pdf",
  "certificate": {
    "id": "cert-123",
    "title": "AWS Certified Developer",
    "issuer": "Amazon Web Services",
    "issuedAt": "2024-01-15T00:00:00.000Z",
    "certificateUrl": "https://..."
  }
}
```

**Note:** If PDF uploaded, the service will attempt to extract certificate info using AI.

---

### 3. Register/Update Company (with Logo)
**Endpoint:** `POST /companies` or `PATCH /companies/:id`  
**Auth Required:** POST: No, PATCH: Yes (Company owner)  
**File Support:** Yes - automatically uploads to Cloudinary if file included
**Database Field:** `companies.logoUrl`

**Request with file:**
```bash
POST /companies
Content-Type: multipart/form-data

logo: [image file]  # File automatically uploaded to Cloudinary
userId: "user-123"
companyName: "Tech Corp"
industry: "Technology"
```

**Request without file:**
```bash
POST /companies
Content-Type: application/json

{
  "userId": "user-123",
  "companyName": "Tech Corp",
  "industry": "Technology",
  "logoUrl": "https://existing-logo-url.com/logo.png"  # Optional
}
```

**Response:**
```json
{
  "message": "Company profile created",
  "company": {
    "id": "company-123",
    "companyName": "Tech Corp",
    "logoUrl": "https://res.cloudinary.com/dxlzc9pbc/image/upload/v123/edusphere_uploads/logo.png",
    ...
  }
}
```

---

### 4. Create/Update Logbook Entry (with Proof)
**Endpoint:** `POST /logbook` or `PUT /logbook/:entryId`  
**Auth Required:** Yes (Student only)  
**File Support:** Yes - automatically uploads to Cloudinary if file included
**Database Field:** `logbook_entries.proofUrl`

**Request with file:**
```bash
POST /logbook
Content-Type: multipart/form-data

proof: [image/document file]  # File automatically uploaded to Cloudinary
applicationId: "app-123"
date: "2024-12-06"
taskDone: "Completed user authentication module"
hours_spent: 8
```

**Request without file:**
```bash
POST /logbook
Content-Type: application/json

{
  "applicationId": "app-123",
  "date": "2024-12-06",
  "taskDone": "Completed user authentication module",
  "proofUrl": "https://existing-proof-url.com/proof.jpg",  # Optional
  "hours_spent": 8
}
```

**Response:**
```json
{
  "message": "Logbook entry created",
  "entry": {
    "id": "entry-123",
    "taskDone": "Completed user authentication module",
    "proofUrl": "https://res.cloudinary.com/dxlzc9pbc/image/upload/v123/edusphere_uploads/proof.jpg",
    "hours_spent": 8,
    ...
  }
}
```

---

### 5. Test Upload (Development Only)
**Endpoint:** `POST /test/upload`  
**Auth Required:** No  
**Field Name:** Any (uses `upload.any()`)  
**Database Field:** None (testing only)

**Request:**
```bash
POST /test/upload
Content-Type: multipart/form-data

file: [any file]
```

**Response:**
```json
{
  "success": true,
  "url": "https://res.cloudinary.com/dxlzc9pbc/raw/upload/v123/edusphere_uploads/file.pdf",
  "originalName": "document.pdf"
}
```

---

## Supported File Types

### Images (resource_type: 'image')
- jpg, jpeg, png, gif, bmp, webp, svg, ico

### Videos (resource_type: 'video')
- mp4, mov, avi, wmv, flv, mkv, webm

### Documents (resource_type: 'raw')
- pdf, doc, docx, and other documents

---

## Implementation Details

### Cloudinary Configuration
Located in: `src/services/cloudinary.service.js`

```javascript
const { uploadOnCloudinary } = require('../services/cloudinary.service');

// Upload file
const cloudinaryUrl = await uploadOnCloudinary(file.path);
```

**Features:**
- Auto-detects file type (image/video/raw)
- Uploads to `edusphere_uploads` folder
- Preserves original filename with unique suffix
- Auto-deletes temp file after upload
- Returns direct download URL

### Environment Variables Required
```env
CLOUDINARY_CLOUD_NAME=dxlzc9pbc
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## Frontend Integration Examples

### React with Axios

**Update Profile with Avatar:**
```javascript
const updateProfileWithAvatar = async (studentId, file, profileData) => {
  const formData = new FormData();
  
  // Add file if present
  if (file) {
    formData.append('avatar', file);
  }
  
  // Add other profile data
  formData.append('bio', profileData.bio);
  formData.append('skills', JSON.stringify(profileData.skills));
  
  const response = await axios.patch(
    `/students/${studentId}/profile`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  return response.data.profile;
};
```

**Create Logbook Entry with Proof:**
```javascript
const createLogbookEntry = async (entryData, proofFile) => {
  const formData = new FormData();
  
  // Add file if present
  if (proofFile) {
    formData.append('proof', proofFile);
  }
  
  // Add logbook data
  formData.append('applicationId', entryData.applicationId);
  formData.append('date', entryData.date);
  formData.append('taskDone', entryData.taskDone);
  formData.append('hours_spent', entryData.hours_spent);
  
  const response = await axios.post(
    '/logbook',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  return response.data.entry;
};
```

### Fetch API

**Upload Certificate:**
```javascript
const uploadCertificate = async (file, metadata) => {
  const formData = new FormData();
  formData.append('certificate', file);
  formData.append('title', metadata.title);
  formData.append('issuer', metadata.issuer);
  formData.append('issueDate', metadata.issueDate);
  
  const response = await fetch('/certifications/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  return await response.json();
};
```

**Update Company with Logo:**
```javascript
const updateCompany = async (companyId, data, logoFile) => {
  const formData = new FormData();
  
  // Add file if present
  if (logoFile) {
    formData.append('logo', logoFile);
  }
  
  // Add company data
  formData.append('companyName', data.companyName);
  formData.append('industry', data.industry);
  formData.append('website', data.website);
  
  const response = await fetch(`/companies/${companyId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  return await response.json();
};
```

---

## Database Schema Reference

```prisma
model profile {
  avatarURL String?  // Student avatar Cloudinary URL
  // ... other fields
}

model certificates {
  certificateUrl String  // Certificate file Cloudinary URL
  // ... other fields
}

model companies {
  logoUrl String?  // Company logo Cloudinary URL
  // ... other fields
}

model logbook_entries {
  proofUrl String?  // Work proof Cloudinary URL
  // ... other fields
}
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "No file uploaded"
}
```

```json
{
  "error": "Failed to upload avatar"
}
```

### Common Errors
- **400 Bad Request** - No file provided
- **403 Forbidden** - Not authorized to upload (wrong owner)
- **404 Not Found** - Profile/Company not found
- **500 Internal Server Error** - Cloudinary upload failed

---

## Notes

1. **File Size Limit:** 10MB (configured in Multer middleware)
2. **Temp Storage:** Files temporarily stored in `public/temp` then deleted after Cloudinary upload
3. **Cloudinary Tier:** Free tier (has limitations on inline PDF viewing)
4. **PDF Viewing:** PDFs will download instead of viewing inline (free tier limitation)
5. **Security:** All upload endpoints require authentication
6. **Ownership:** Users can only upload files for their own profiles/companies
