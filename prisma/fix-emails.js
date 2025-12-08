const { PrismaClient } = require('@prisma/client');
const { randomBytes, createHmac } = require('node:crypto');

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing faculty email addresses...');

  // Fix Dr. Ramesh Kumar email
  const user1 = await prisma.users.findFirst({
    where: { email: 'dr..ramesh.kumar@faculty.com' }
  });

  if (user1) {
    await prisma.users.update({
      where: { id: user1.id },
      data: { email: 'dr.ramesh.kumar@faculty.com' }
    });
    console.log('✅ Fixed: dr..ramesh.kumar → dr.ramesh.kumar');
  }

  // Verify all faculty users now
  console.log('\n📋 Updated Faculty Users:');
  const faculty = await prisma.users.findMany({
    where: { role: 'faculty' },
    select: { email: true, displayName: true }
  });
  console.log(faculty);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
