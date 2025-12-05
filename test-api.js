// Quick API Test Script
// Run with: node test-api.js

const baseURL = 'http://localhost:8000';

async function testEndpoint(method, endpoint, description) {
  try {
    const response = await fetch(`${baseURL}${endpoint}`, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const status = response.status;
    const statusText = response.statusText;
    
    console.log(`✓ ${method} ${endpoint} - ${status} ${statusText} - ${description}`);
    
    return { success: true, status };
  } catch (error) {
    console.log(`✗ ${method} ${endpoint} - ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('\n🧪 Testing EduSphere API Endpoints\n');
  console.log('='.repeat(60));
  
  console.log('\n📍 HOME ROUTE');
  await testEndpoint('GET', '/', 'API home page');
  
  console.log('\n📍 PUBLIC ENDPOINTS (No Auth Required)');
  await testEndpoint('GET', '/institutes', 'List institutes');
  await testEndpoint('GET', '/faculty', 'List faculty');
  await testEndpoint('GET', '/jobs', 'List jobs/internships');
  
  console.log('\n📍 AUTH ENDPOINTS');
  await testEndpoint('POST', '/auth/register', 'User registration (expects body)');
  await testEndpoint('POST', '/auth/login', 'User login (expects body)');
  
  console.log('\n📍 AUTHENTICATED ENDPOINTS (Expected 401)');
  await testEndpoint('GET', '/users/me', 'Get current user profile');
  await testEndpoint('GET', '/logbook/my', 'Get my logbook entries');
  await testEndpoint('GET', '/faculty/me/profile', 'Get faculty profile');
  
  console.log('\n📍 ADMIN/SUPERADMIN ENDPOINTS (Expected 401/403)');
  await testEndpoint('POST', '/institutes/register', 'Register institute');
  await testEndpoint('GET', '/users', 'List all users');
  await testEndpoint('POST', '/auth/admin/users/invite', 'Invite users');
  
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Test suite completed!');
  console.log('\nNote: 400/401/403 errors are expected for endpoints requiring authentication or specific data.\n');
}

// Run tests
runTests().catch(console.error);
