/**
 * Mentor API Integration Test Script
 * Tests all mentor endpoints to verify functionality
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8000';
let authToken = '';
let mentorId = '';
let userId = '';
let sessionId = '';

// Test credentials - we'll create a test mentor
const TEST_MENTOR = {
  displayName: 'Test Mentor API',
  email: `testmentor_${Date.now()}@test.com`,
  password: 'TestPassword123',
  role: 'mentor',
  expertise: 'Software Engineering, Career Guidance',
  experience: '5'
};

// Helper function to make authenticated requests
const authRequest = (method, url, data = null) => {
  const config = {
    method,
    url: `${BASE_URL}${url}`,
    headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
    data
  };
  return axios(config);
};

// Test results tracker
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, message = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (message) console.log(`   ${message}`);
  
  results.tests.push({ name, passed, message });
  if (passed) results.passed++;
  else results.failed++;
}

async function runTests() {
  console.log('\n🧪 Starting Mentor API Integration Tests...\n');
  console.log('='.repeat(60));

  try {
    // TEST 1: Register Mentor
    console.log('\n📝 TEST 1: Mentor Registration');
    try {
      const registerResponse = await authRequest('POST', '/api/auth/register', TEST_MENTOR);
      userId = registerResponse.data.id;
      logTest('Register Mentor', true, `User ID: ${userId}`);
    } catch (error) {
      if (error.response?.data?.message?.includes('already exists')) {
        // Try with different email
        TEST_MENTOR.email = `testmentor_${Date.now()}_v2@test.com`;
        const registerResponse = await authRequest('POST', '/api/auth/register', TEST_MENTOR);
        userId = registerResponse.data.id;
        logTest('Register Mentor (retry)', true, `User ID: ${userId}`);
      } else {
        throw error;
      }
    }

    // TEST 2: Mentor Login
    console.log('\n🔐 TEST 2: Mentor Login');
    try {
      const loginResponse = await authRequest('POST', '/api/auth/login', {
        email: TEST_MENTOR.email,
        password: TEST_MENTOR.password
      });
      authToken = loginResponse.data.token;
      mentorId = loginResponse.data.user.id;
      logTest('Mentor Login', true, `Token received, Role: ${loginResponse.data.user.role}`);
    } catch (error) {
      logTest('Mentor Login', false, error.response?.data?.message || error.message);
      throw error; // Stop if login fails
    }

    // TEST 3: Get Mentor Profile
    console.log('\n👤 TEST 3: Get Mentor Profile');
    try {
      const profileResponse = await authRequest('GET', '/api/mentor/me/profile');
      logTest('Get Mentor Profile', profileResponse.data.success, 
        `Name: ${profileResponse.data.mentor?.name || 'N/A'}`);
    } catch (error) {
      logTest('Get Mentor Profile', false, error.response?.data?.error || error.message);
    }

    // TEST 4: Update Mentor Profile
    console.log('\n✏️ TEST 4: Update Mentor Profile');
    try {
      const updateResponse = await authRequest('PUT', '/api/mentor/me/profile', {
        expertise: 'Updated Software Engineering, AI, ML',
        experience: '7',
        bio: 'Experienced mentor in software development and AI'
      });
      logTest('Update Mentor Profile', updateResponse.data.success, 
        updateResponse.data.message);
    } catch (error) {
      logTest('Update Mentor Profile', false, error.response?.data?.error || error.message);
    }

    // TEST 5: Get Dashboard Stats
    console.log('\n📊 TEST 5: Get Dashboard Stats');
    try {
      const statsResponse = await authRequest('GET', '/api/mentor/me/stats');
      const stats = statsResponse.data;
      logTest('Get Dashboard Stats', stats.success, 
        `Students: ${stats.totalStudents || 0}, Sessions: ${stats.totalSessions || 0}`);
    } catch (error) {
      logTest('Get Dashboard Stats', false, error.response?.data?.error || error.message);
    }

    // TEST 6: Get Mentor Sessions
    console.log('\n📅 TEST 6: Get Mentor Sessions');
    try {
      const sessionsResponse = await authRequest('GET', '/api/mentor/me/sessions');
      const sessions = sessionsResponse.data.sessions || [];
      logTest('Get Mentor Sessions', sessionsResponse.data.success, 
        `Found ${sessions.length} sessions`);
      
      if (sessions.length > 0) {
        sessionId = sessions[0].id;
      }
    } catch (error) {
      logTest('Get Mentor Sessions', false, error.response?.data?.error || error.message);
    }

    // TEST 7: Get Assigned Students
    console.log('\n👥 TEST 7: Get Assigned Students');
    try {
      const studentsResponse = await authRequest('GET', '/api/mentor/me/students');
      const students = studentsResponse.data.students || [];
      logTest('Get Assigned Students', studentsResponse.data.success, 
        `Found ${students.length} students`);
    } catch (error) {
      logTest('Get Assigned Students', false, error.response?.data?.error || error.message);
    }

    // TEST 8: Get Availability
    console.log('\n🕐 TEST 8: Get Mentor Availability');
    try {
      const availResponse = await authRequest('GET', '/api/mentor/me/availability');
      logTest('Get Availability', availResponse.data.success, 
        `Availability slots retrieved`);
    } catch (error) {
      logTest('Get Availability', false, error.response?.data?.error || error.message);
    }

    // TEST 9: Update Availability
    console.log('\n🕐 TEST 9: Update Mentor Availability');
    try {
      const updateAvailResponse = await authRequest('PUT', '/api/mentor/me/availability', {
        availability: {
          Monday: ['09:00-10:00', '14:00-15:00'],
          Tuesday: ['10:00-11:00'],
          Wednesday: ['09:00-10:00', '14:00-15:00'],
          Thursday: [],
          Friday: ['13:00-14:00', '15:00-16:00'],
          Saturday: [],
          Sunday: []
        }
      });
      logTest('Update Availability', updateAvailResponse.data.success, 
        updateAvailResponse.data.message);
    } catch (error) {
      logTest('Update Availability', false, error.response?.data?.error || error.message);
    }

    // TEST 10: Get All Mentors (Public)
    console.log('\n🔍 TEST 10: Get All Mentors (Public Endpoint)');
    try {
      const mentorsResponse = await authRequest('GET', '/api/mentor');
      const mentors = mentorsResponse.data.mentors || [];
      logTest('Get All Mentors', mentorsResponse.data.success, 
        `Found ${mentors.length} mentors`);
    } catch (error) {
      logTest('Get All Mentors', false, error.response?.data?.error || error.message);
    }

    // TEST 11: Get Specific Mentor by ID (Public)
    console.log('\n🔍 TEST 11: Get Mentor by ID');
    try {
      // First get the mentor profile to find mentor ID
      const profileResponse = await authRequest('GET', '/api/mentor/me/profile');
      const currentMentorId = profileResponse.data.mentor?.id;
      
      if (currentMentorId) {
        const mentorResponse = await authRequest('GET', `/api/mentor/${currentMentorId}`);
        logTest('Get Mentor by ID', mentorResponse.data.success, 
          `Mentor details retrieved`);
      } else {
        logTest('Get Mentor by ID', false, 'Could not get mentor ID');
      }
    } catch (error) {
      logTest('Get Mentor by ID', false, error.response?.data?.error || error.message);
    }

    // TEST 12: Get Notifications
    console.log('\n🔔 TEST 12: Get Notifications');
    try {
      const notifsResponse = await authRequest('GET', '/api/notifications/my');
      const notifs = notifsResponse.data.notifications || notifsResponse.data || [];
      logTest('Get Notifications', true, `Found ${notifs.length} notifications`);
    } catch (error) {
      logTest('Get Notifications', false, error.response?.data?.error || error.message);
    }

    // TEST 13: Update Session Status (if session exists)
    if (sessionId) {
      console.log('\n✏️ TEST 13: Update Session Status');
      try {
        const updateSessionResponse = await authRequest('PUT', `/api/mentor/me/sessions/${sessionId}`, {
          status: 'completed',
          notes: 'Test session completed successfully'
        });
        logTest('Update Session Status', updateSessionResponse.data.success, 
          updateSessionResponse.data.message);
      } catch (error) {
        logTest('Update Session Status', false, error.response?.data?.error || error.message);
      }
    } else {
      logTest('Update Session Status', false, 'No session ID available to test');
    }

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }

  // Print Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📋 TEST SUMMARY:');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📊 Total:  ${results.tests.length}`);
  console.log(`🎯 Success Rate: ${((results.passed / results.tests.length) * 100).toFixed(1)}%`);
  console.log('\n' + '='.repeat(60));

  // Show failed tests details
  if (results.failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.tests.filter(t => !t.passed).forEach(t => {
      console.log(`   - ${t.name}: ${t.message}`);
    });
  }

  console.log('\n✨ Test run completed!\n');
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
