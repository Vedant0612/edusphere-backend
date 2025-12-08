/**
 * Student Dashboard API Integration Test
 * Tests all student-related endpoints
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8000';
const TEST_EMAIL = `student_${Date.now()}@test.com`;
const TEST_PASSWORD = 'Test@1234';

let authToken = null;
let userId = null;
let profileId = null;
let applicationId = null;
let logbookEntryId = null;
let certificationId = null;

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

// Add auth token to requests
api.interceptors.request.use(config => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

const tests = [];
let passCount = 0;
let failCount = 0;

function logTest(name, passed, details = '') {
  tests.push({ name, passed, details });
  if (passed) {
    console.log(`✅ ${name}`);
    passCount++;
  } else {
    console.log(`❌ ${name}`);
    if (details) console.log(`   ${details}`);
    failCount++;
  }
}

async function runTests() {
  console.log('\n🧪 Testing Student Dashboard APIs...\n');

  try {
    // 1. STUDENT REGISTRATION
    try {
      const response = await api.post('/api/auth/register', {
        displayName: 'Test Student',
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        role: 'student'  // lowercase as required by backend
      });
      userId = response.data.id; // Registration returns id directly
      logTest('1. Student Registration', !!userId);
    } catch (error) {
      logTest('1. Student Registration', false, error.response?.data?.message || error.message);
      // Try to continue even if user already exists
    }

    // 2. STUDENT LOGIN (required for auth token)
    try {
      const response = await api.post('/api/auth/login', {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      });
      authToken = response.data.token;
      userId = response.data.user?.id; // Get userId from login if registration failed
      logTest('2. Student Login', !!authToken && !!userId);
    } catch (error) {
      logTest('2. Student Login', false, error.response?.data?.message || error.message);
      return; // Can't continue without auth
    }

    // 3. CREATE STUDENT PROFILE
    try {
      // First get an institute (assuming one exists)
      const instituteRes = await api.get('/api/institutes');
      const instituteId = instituteRes.data[0]?.id;

      if (!instituteId) {
        logTest('3. Create Student Profile', false, 'No institute found in DB');
      } else {
        const response = await api.post('/api/students', {
          userId,
          instituteId,
          bio: 'Test student profile',
          department: 'Computer Science',
          skills: ['React', 'Node.js'],
          interests: ['Web Development']
        });
        profileId = response.data.profile?.id;
        logTest('3. Create Student Profile', !!profileId);
      }
    } catch (error) {
      logTest('3. Create Student Profile', false, error.response?.data?.error || error.message);
    }

    // 4. GET STUDENT PROFILE
    try {
      const response = await api.get(`/api/students/user/${userId}`);
      logTest('4. Get Student Profile', response.data?.userId === userId);
    } catch (error) {
      logTest('4. Get Student Profile', false, error.response?.data?.error || error.message);
    }

    // 5. UPDATE STUDENT PROFILE
    try {
      const response = await api.put(`/api/students/user/${userId}`, {
        bio: 'Updated bio',
        github: 'https://github.com/teststudent'
      });
      logTest('5. Update Student Profile', response.data?.profile?.github?.includes('github'));
    } catch (error) {
      logTest('5. Update Student Profile', false, error.response?.data?.error || error.message);
    }

    // 6. GET ALL INTERNSHIPS
    try {
      const response = await api.get('/api/internships');
      const internships = response.data.internships || response.data; // Handle wrapped response
      const passed = Array.isArray(internships);
      logTest('6. Get All Internships', passed);
      if (passed) {
        console.log(`   Found ${internships.length} internships in database`);
      }
    } catch (error) {
      logTest('6. Get All Internships', false, error.response?.data?.error || error.message);
    }

    // 7. GET STUDENT APPLICATIONS (should be empty initially)
    try {
      if (profileId) {
        const response = await api.get(`/api/students/${profileId}/applications`);
        const apps = response.data.applications || response.data;
        const passed = Array.isArray(apps);
        logTest('7. Get Student Applications', passed);
        if (passed) console.log(`   Found ${apps.length} applications`);
      } else {
        logTest('7. Get Student Applications', false, 'No profile ID');
      }
    } catch (error) {
      logTest('7. Get Student Applications', false, error.response?.data?.error || error.message);
    }

    // 8. CREATE LOGBOOK ENTRY (requires application)
    try {
      // First check if there are any internships
      const internshipsRes = await api.get('/api/internships');
      const internships = internshipsRes.data.internships || internshipsRes.data;
      const internship = internships[0];

      if (!internship || !profileId) {
        logTest('8. Create Logbook Entry', false, 'No internship or profile to create application');
      } else {
        // Create application first
        const appRes = await api.post('/api/applications', {
          internship_id: internship.id,
          student_id: profileId,
          status: 'APPLIED'
        });
        applicationId = appRes.data.application?.id;

        if (!applicationId) {
          logTest('8. Create Logbook Entry', false, 'Failed to create application');
        } else {
          // Now create logbook entry
          const response = await api.post('/api/logbook', {
            applicationId,
            date: new Date().toISOString(),
            taskDone: 'Completed React components',
            hours_spent: 4
          });
          logbookEntryId = response.data.entry?.id;
          logTest('8. Create Logbook Entry', !!logbookEntryId);
        }
      }
    } catch (error) {
      logTest('8. Create Logbook Entry', false, error.response?.data?.error || error.response?.data?.details || error.message);
      console.log('   Error details:', error.response?.data);
    }

    // 9. GET MY LOGBOOK ENTRIES
    try {
      const response = await api.get('/api/logbook/my');
      const entries = response.data.entries || response.data;
      const passed = Array.isArray(entries);
      logTest('9. Get My Logbook Entries', passed);
      if (passed) console.log(`   Found ${entries.length} logbook entries`);
    } catch (error) {
      logTest('9. Get My Logbook Entries', false, error.response?.data?.error || error.message);
    }

    // 10. UPDATE LOGBOOK ENTRY
    try {
      if (logbookEntryId) {
        const response = await api.put(`/api/logbook/${logbookEntryId}`, {
          taskDone: 'Updated: Completed React and Redux',
          hours_spent: 5
        });
        logTest('10. Update Logbook Entry', response.data?.entry?.hours_spent === 5);
      } else {
        logTest('10. Update Logbook Entry', false, 'No logbook entry to update');
      }
    } catch (error) {
      logTest('10. Update Logbook Entry', false, error.response?.data?.error || error.message);
    }

    // 11. GET ALL CERTIFICATIONS
    try {
      const response = await api.get('/api/certifications');
      const certs = response.data.certificates || response.data;
      const passed = Array.isArray(certs);
      logTest('11. Get All Certifications', passed);
      if (passed) console.log(`   Found ${certs.length} certifications`);
    } catch (error) {
      logTest('11. Get All Certifications', false, error.response?.data?.error || error.message);
    }

    // 12. GET USER COURSE ENROLLMENTS
    try {
      const response = await api.get(`/api/users/${userId}/enrollments`);
      logTest('12. Get Course Enrollments', Array.isArray(response.data));
    } catch (error) {
      logTest('12. Get Course Enrollments', false, error.response?.data?.error || error.message);
    }

    // 13. GET NOTIFICATIONS
    try {
      const response = await api.get('/api/notifications/my');
      const notifs = response.data.notifications || response.data;
      const passed = Array.isArray(notifs);
      logTest('13. Get Notifications', passed);
      if (passed) console.log(`   Found ${notifs.length} notifications`);
    } catch (error) {
      logTest('13. Get Notifications', false, error.response?.data?.error || error.message);
    }

    // 14. DELETE LOGBOOK ENTRY
    try {
      if (logbookEntryId) {
        await api.delete(`/api/logbook/${logbookEntryId}`);
        logTest('14. Delete Logbook Entry', true);
      } else {
        logTest('14. Delete Logbook Entry', false, 'No logbook entry to delete');
      }
    } catch (error) {
      logTest('14. Delete Logbook Entry', false, error.response?.data?.error || error.message);
    }

    // 15. GET STUDENT DASHBOARD STATS
    try {
      if (profileId) {
        // This is a composite test - checking if we can gather all data for dashboard
        const [profile, applications, enrollments] = await Promise.all([
          api.get(`/api/students/user/${userId}`),
          api.get(`/api/students/${profileId}/applications`),
          api.get(`/api/users/${userId}/enrollments`)
        ]);

        const hasData = profile.data && Array.isArray(applications.data) && Array.isArray(enrollments.data);
        logTest('15. Get Dashboard Stats (Composite)', hasData);
      } else {
        logTest('15. Get Dashboard Stats (Composite)', false, 'No profile ID');
      }
    } catch (error) {
      logTest('15. Get Dashboard Stats (Composite)', false, error.response?.data?.error || error.message);
    }

  } catch (error) {
    console.error('\n❌ Unexpected error:', error.message);
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${tests.length}`);
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`Success Rate: ${((passCount / tests.length) * 100).toFixed(1)}%`);
  console.log('='.repeat(50));

  if (failCount > 0) {
    console.log('\nFailed Tests:');
    tests.filter(t => !t.passed).forEach(t => {
      console.log(`  - ${t.name}`);
      if (t.details) console.log(`    ${t.details}`);
    });
  }

  console.log('\n✨ Test run completed!\n');
}

// Run tests
runTests().catch(console.error);
