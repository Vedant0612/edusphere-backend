# Database Schema Updates - Frontend Alignment

## Summary
Updated Prisma schema to include all fields that the frontend signup forms are collecting.

## Changes Made

### 1. **users** Model
**Added Fields:**
- `graduationYear Int?` - For student graduation year
- `createdAt DateTime @default(now())` - Timestamp of account creation
- `updatedAt DateTime @updatedAt` - Last updated timestamp

**Usage:** Stores graduation year directly on user for students during signup

---

### 2. **institutions** Model
**Added Fields:**
- `domain String?` - Email domain (e.g., "iit.ac.in", "vardhaman.org")
- `city String?` - City location
- `address String?` - Full address
- `updatedAt DateTime @updatedAt` - Last updated timestamp

**Made Optional:**
- `state String?` - Changed from required to optional

**Usage:** Supports institution selection during student/faculty signup with domain matching

---

### 3. **profile** Model  
**Added Fields:**
- `graduationYear Int?` - Student graduation year (also in users table for redundancy)
- `createdAt DateTime @default(now())` - Profile creation timestamp
- `updatedAt DateTime @updatedAt` - Last updated timestamp

**Usage:** Student profile with graduation year for tracking cohorts

---

### 4. **faculty** Model
**Added Fields:**
- `phoneCode String?` - Phone country code (e.g., "+91", "+1")
- `phoneNumber String?` - Phone number
- `createdAt DateTime @default(now())` - Faculty record creation
- `updatedAt DateTime @updatedAt` - Last updated timestamp

**Usage:** Stores faculty contact information collected during signup

---

### 5. **companies** Model
**Added Fields:**
- `officialEmail String?` - Company's official email address
- `contactName String?` - HR/Contact person full name
- `updatedAt DateTime @updatedAt` - Last updated timestamp

**Usage:** Stores HR contact info and company email from company signup form

---

### 6. **mentors** Model
**Changed Fields:**
- `expertise String?` - Changed from `Json?` to `String?` for area of expertise
- `experience String?` - Added for years of experience

**Added Fields:**
- `createdAt DateTime @default(now())` - Mentor record creation

**Usage:** Stores mentor expertise and experience years from signup

---

## Frontend Form Fields Mapping

### Student Signup (`StudentSignupPage.jsx`)
```javascript
{
  fullName: ""          → users.displayName
  collegeEmail: ""      → users.email
  phone: ""             → users.phone
  gradYear: ""          → users.graduationYear + profile.graduationYear
  password: ""          → users.hashPassword (hashed)
  institution: ""       → profile.instituteId (from institutions)
}
```

### Faculty Signup (`FacultySignupPage.jsx`)
```javascript
{
  fullName: ""              → users.displayName
  institutionalEmail: ""    → users.email
  phoneCode: "+91"          → faculty.phoneCode
  phoneNumber: ""           → faculty.phoneNumber
  department: ""            → faculty.department
  password: ""              → users.hashPassword (hashed)
  institution: ""           → faculty.instituteId (from institutions)
}
```

### Mentor Signup (`MentorSignupPage.jsx`)
```javascript
{
  fullName: ""      → users.displayName
  email: ""         → users.email
  password: ""      → users.hashPassword (hashed)
  expertise: ""     → mentors.expertise
  experience: ""    → mentors.experience
}
```

### Company Signup (`CompanySignupPage.jsx`)
```javascript
{
  companyName: ""       → companies.companyName
  companyWebsite: ""    → companies.website
  officialEmail: ""     → companies.officialEmail
  contactName: ""       → companies.contactName
  phoneCode: "+91"      → users.phone (combined with phoneNumber)
  phoneNumber: ""       → users.phone
  password: ""          → users.hashPassword (hashed)
}
```

---

## Migration Steps

### 1. Generate Migration
```bash
cd edusphere-backend
npx prisma migrate dev --name add_signup_fields
```

### 2. Apply to Database
The migration will:
- Add new columns to existing tables
- Set defaults for timestamp fields
- Handle nullable fields gracefully

### 3. Update Seed Data (if needed)
Update `prisma/seed.js` to include new fields when creating test data.

---

## Backend Route Updates Needed

### Registration Endpoints Need to Handle:

**Student Registration:**
```javascript
// POST /api/auth/register
{
  displayName: req.body.fullName,
  email: req.body.collegeEmail,
  phone: req.body.phone,
  graduationYear: parseInt(req.body.gradYear),
  password: req.body.password,
  role: "STUDENT",
  instituteId: req.body.institutionId
}
```

**Faculty Registration:**
```javascript
// POST /api/auth/register
{
  displayName: req.body.fullName,
  email: req.body.institutionalEmail,
  phone: `${req.body.phoneCode}${req.body.phoneNumber}`,
  password: req.body.password,
  role: "FACULTY",
  faculty: {
    department: req.body.department,
    phoneCode: req.body.phoneCode,
    phoneNumber: req.body.phoneNumber,
    instituteId: req.body.institutionId
  }
}
```

**Mentor Registration:**
```javascript
// POST /api/auth/register
{
  displayName: req.body.fullName,
  email: req.body.email,
  password: req.body.password,
  role: "MENTOR",
  mentor: {
    expertise: req.body.expertise,
    experience: req.body.experience
  }
}
```

**Company Registration:**
```javascript
// POST /api/auth/register
{
  displayName: req.body.contactName,
  email: req.body.officialEmail,
  phone: `${req.body.phoneCode}${req.body.phoneNumber}`,
  password: req.body.password,
  role: "COMPANY",
  company: {
    companyName: req.body.companyName,
    website: req.body.companyWebsite,
    officialEmail: req.body.officialEmail,
    contactName: req.body.contactName
  }
}
```

---

## Validation Rules

Add these validations in backend:

### All Users
- `email`: Valid email format, unique
- `phone`: Valid phone format
- `password`: Min 8 characters, includes uppercase, number, special char

### Students
- `graduationYear`: Between current year and current year + 10

### Faculty
- `phoneCode`: Valid country code
- `department`: Non-empty string

### Mentors
- `expertise`: Non-empty string
- `experience`: Numeric or valid format (e.g., "5 years", "5")

### Companies
- `website`: Valid URL format (optional)
- `companyName`: Non-empty, unique preferred

---

## Testing Checklist

- [ ] Run migration successfully
- [ ] Test student registration with all fields
- [ ] Test faculty registration with phone code
- [ ] Test mentor registration with expertise/experience
- [ ] Test company registration with contact details
- [ ] Verify timestamps are auto-populated
- [ ] Check foreign key relationships work
- [ ] Validate optional fields can be null

---

## Notes

1. **graduationYear** appears in both `users` and `profile` tables:
   - `users.graduationYear`: Quick access for filtering/auth
   - `profile.graduationYear`: Detailed profile information
   
2. **Phone Storage**: Currently stored as single string in users table. Consider:
   - Storing `phoneCode` and `phoneNumber` separately in users table
   - Or concatenating during registration

3. **Institution Matching**: Frontend uses institution domain for email verification. Backend should:
   - Validate student email matches institution domain
   - Validate faculty email matches institution domain

4. **Timestamps**: Added `createdAt` and `updatedAt` for better audit trail
