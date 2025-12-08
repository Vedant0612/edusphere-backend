// prisma/update-passwords.js
const { PrismaClient } = require('@prisma/client');
const { randomBytes, createHmac } = require('node:crypto');

const prisma = new PrismaClient();

async function main() {
  console.log('🔐 Updating passwords to password123...');

  // Update super admin
  const adminSalt = randomBytes(16).toString('hex');
  const adminHash = createHmac('sha256', adminSalt).update('password123').digest('hex');
  await prisma.users.updateMany({
    where: { email: 'admin@edusphere.com' },
    data: { hashPassword: adminHash, salt: adminSalt }
  });
  console.log('✅ Updated super admin password');

  // Update companies
  const companies = ['googleindia', 'microsoft', 'amazon', 'flipkart', 'infosys'];
  for (const comp of companies) {
    const compSalt = randomBytes(16).toString('hex');
    const compHash = createHmac('sha256', compSalt).update('password123').digest('hex');
    await prisma.users.updateMany({
      where: { email: `${comp}@company.com` },
      data: { hashPassword: compHash, salt: compSalt }
    });
    console.log(`✅ Updated ${comp} password`);
  }

  // Update mentors
  const mentors = ['aisha.khan', 'rohit.sharma', 'dr.priya.singh'];
  for (const mentor of mentors) {
    const mentorSalt = randomBytes(16).toString('hex');
    const mentorHash = createHmac('sha256', mentorSalt).update('password123').digest('hex');
    await prisma.users.updateMany({
      where: { email: `${mentor}@mentor.com` },
      data: { hashPassword: mentorHash, salt: mentorSalt }
    });
    console.log(`✅ Updated ${mentor} password`);
  }

  // Update faculty
  const faculty = ['dr.ramesh.kumar', 'prof.anjali.sharma'];
  for (const fac of faculty) {
    const facSalt = randomBytes(16).toString('hex');
    const facHash = createHmac('sha256', facSalt).update('password123').digest('hex');
    await prisma.users.updateMany({
      where: { email: `${fac}@faculty.com` },
      data: { hashPassword: facHash, salt: facSalt }
    });
    console.log(`✅ Updated ${fac} password`);
  }

  console.log('\n🎉 All passwords updated to password123!');
  console.log('\n📝 Test Credentials:');
  console.log('   Super Admin: admin@edusphere.com : password123');
  console.log('   Company: googleindia@company.com : password123');
  console.log('   Mentor: aisha.khan@mentor.com : password123');
  console.log('   Faculty: dr.ramesh.kumar@faculty.com : password123');
}

main()
  .catch((e) => {
    console.error('❌ Error updating passwords:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
