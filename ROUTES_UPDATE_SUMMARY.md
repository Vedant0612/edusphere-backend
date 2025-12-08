# Backend Routes Updated - Summary

## ✅ Routes Updated to Handle New Schema Fields

### 1. **auth.routes.js** - Registration & Login

#### POST `/api/auth/register`
**Updated to handle:**
- ✅ Student registration with `graduationYear`, `instituteId`, `department`
- ✅ Faculty registration with `phoneCode`, `phoneNumber`, `department`
- ✅ Mentor registration with `expertise`, `experience`
- ✅ Company registration with `companyName`, `website`, `officialEmail`, `contactName`

**What it does:**
1. Creates user in `users` table
2. Auto-creates role-specific profile:
   - Student → creates `profile` record
   - Mentor → creates `mentors` record
   - Company → creates `companies` record

**Example Requests:**

**Student:**
```json
POST /api/auth/register
{
  "displayName": "John Doe",
  "email": "john@vardhaman.org",
  "password": "SecurePass123!",
  "role": "student",
  "phone": "9876543210",
  "graduationYear": 2026,
  "instituteId": "uuid-of-institution",
  "department": "Computer Science"
}
```

**Mentor:**
```json
POST /api/auth/register
{
  "displayName": "Jane Smith",
  "email": "jane@example.com",
  "password": "SecurePass123!",
  "role": "mentor",
  "phone": "9876543210",
  "expertise": "Full Stack Development",
  "experience": "5 years"
}
```

**Company:**
```json
POST /api/auth/register
{
  "displayName": "HR Manager",
  "email": "hr@company.com",
  "password": "SecurePass123!",
  "role": "company",
  "phoneCode": "+91",
  "phoneNumber": "9876543210",
  "companyName": "Tech Corp",
  "website": "https://techcorp.com",
  "officialEmail": "contact@techcorp.com",
  "contactName": "HR Manager"
}
```

#### POST `/api/auth/login`
**Updated Response:**
- ✅ Returns `graduationYear` for students
- ✅ Includes role-specific profile data:
  - Student → `profile` with institution
  - Mentor → `mentor` with expertise/experience
  - Company → `company` details
  - Faculty → `faculty` with institution

---

### 2. **students.routes.js** - Student Profiles

#### POST `/api/students`
**Added Field:**
- ✅ `graduationYear` (stored in profile table)

**Updated:**
```javascript
{
  userId,
  instituteId,
  graduationYear: 2026,  // NEW
  department,
  bio,
  skills,
  // ... other fields
}
```

---

### 3. **companies.routes.js** - Company Profiles

#### POST `/api/companies`
**Added Fields:**
- ✅ `officialEmail` - Company official email
- ✅ `contactName` - HR/Contact person name

**Updated:**
```javascript
{
  userId,
  companyName,
  website,
  officialEmail: "contact@company.com",  // NEW
  contactName: "HR Manager",              // NEW
  industry,
  description,
  location
}
```

---

### 4. **faculty.routes.js** - Faculty Profiles

#### POST `/api/faculty/register`
**Added Fields:**
- ✅ `phoneCode` - Phone country code (e.g., "+91")
- ✅ `phoneNumber` - Phone number

**Updated:**
```javascript
{
  instituteId,
  userId,
  department,
  phoneCode: "+91",     // NEW
  phoneNumber: "9876543210"  // NEW
}
```

---

### 5. **mentor.routes.js** - Mentor Profiles

#### POST `/api/mentor/register`
**Updated Field:**
- ✅ `expertise` - Changed from JSON to String
- ✅ `experience` - Added for years of experience

#### PUT `/api/mentor/:id`
**Updated to handle:**
- ✅ `experience` field updates

**Updated:**
```javascript
{
  expertise: "Full Stack Development",  // Now String
  experience: "5 years",                // NEW
  bio: "Experienced developer..."
}
```

---

## Database Migration Required

Run this command to apply schema changes:

```bash
cd edusphere-backend
npx prisma migrate dev --name add_signup_form_fields
```

This will:
1. Add new columns to existing tables
2. Update field types (mentors.expertise: Json → String)
3. Set default values for timestamps
4. Handle nullable fields

---

## Testing Checklist

### Student Registration
- [ ] POST `/api/auth/register` with student data
- [ ] Verify `graduationYear` saved in users table
- [ ] Verify profile created with instituteId
- [ ] POST `/api/auth/login` returns profile data

### Faculty Registration (Admin Invite)
- [ ] POST `/api/auth/admin/users/invite` for faculty
- [ ] Verify faculty record has phoneCode/phoneNumber
- [ ] POST `/api/faculty/register` with phone fields

### Mentor Registration
- [ ] POST `/api/auth/register` with mentor data
- [ ] Verify expertise saved as string
- [ ] Verify experience field populated
- [ ] PUT `/api/mentor/:id` updates all fields

### Company Registration
- [ ] POST `/api/auth/register` with company data
- [ ] Verify company profile created automatically
- [ ] Check officialEmail and contactName saved
- [ ] POST `/api/auth/login` returns company data

---

## API Response Examples

### Login Response (Student)
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "student@iit.ac.in",
    "displayName": "John Doe",
    "role": "student",
    "phone": "9876543210",
    "graduationYear": 2026,
    "profile": {
      "id": "uuid",
      "instituteId": "uuid",
      "department": "Computer Science",
      "graduationYear": 2026,
      "institution": {
        "instituteName": "IIT Delhi",
        "domain": "iit.ac.in"
      }
    }
  },
  "token": "jwt-token-here"
}
```

### Login Response (Company)
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "hr@techcorp.com",
    "displayName": "HR Manager",
    "role": "company",
    "phone": "+919876543210",
    "company": {
      "id": "uuid",
      "companyName": "Tech Corp",
      "website": "https://techcorp.com",
      "officialEmail": "contact@techcorp.com",
      "contactName": "HR Manager"
    }
  },
  "token": "jwt-token-here"
}
```

---

## Frontend Integration

Update frontend API calls to send all required fields:

### Student Signup
```javascript
await apiService.auth.register({
  displayName: formData.fullName,
  email: formData.collegeEmail,
  password: formData.password,
  role: "student",
  phone: formData.phone,
  graduationYear: parseInt(formData.gradYear),
  instituteId: selectedInstitution.id,
  department: formData.department
});
```

### Mentor Signup
```javascript
await apiService.auth.register({
  displayName: formData.fullName,
  email: formData.email,
  password: formData.password,
  role: "mentor",
  expertise: formData.expertise,
  experience: formData.experience
});
```

### Company Signup
```javascript
await apiService.auth.register({
  displayName: formData.contactName,
  email: formData.officialEmail,
  password: formData.password,
  role: "company",
  phoneCode: formData.phoneCode,
  phoneNumber: formData.phoneNumber,
  companyName: formData.companyName,
  website: formData.companyWebsite,
  officialEmail: formData.officialEmail,
  contactName: formData.contactName
});
```

---

## Notes

1. **Phone Number Handling**: Currently combines `phoneCode` + `phoneNumber` into single `phone` field in users table
2. **Auto Profile Creation**: Registration now automatically creates role-specific profiles
3. **Validation**: Add validation for:
   - graduationYear (must be between current year and +10)
   - email domain matching institution domain
   - phone number format
4. **Error Handling**: All routes return descriptive error messages
5. **Backward Compatibility**: Optional fields are nullable, won't break existing data

---

## Next Steps

1. ✅ Schema updated
2. ✅ Routes updated
3. ⏳ Run migration: `npx prisma migrate dev`
4. ⏳ Test all registration endpoints
5. ⏳ Update frontend signup forms to send correct fields
6. ⏳ Test login with new fields
7. ⏳ Verify profile data returned correctly
