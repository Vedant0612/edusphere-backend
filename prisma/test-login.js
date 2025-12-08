const { PrismaClient } = require('@prisma/client');
const { createHmac } = require('node:crypto');

const prisma = new PrismaClient();

async function main() {
  const email = 'dr.ramesh.kumar@faculty.com';
  const password = 'password123';

  // Get user from database
  const user = await prisma.users.findUnique({
    where: { email },
    select: { salt: true, hashPassword: true, displayName: true }
  });

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log('👤 User:', user.displayName);
  console.log('🧂 Salt:', user.salt);
  console.log('🔐 Stored Hash:', user.hashPassword);

  // Hash the password with the salt
  const testHash = createHmac('sha256', user.salt)
    .update(password)
    .digest('hex');

  console.log('🔑 Test Hash:', testHash);
  console.log('\n✅ Match:', testHash === user.hashPassword ? 'YES - Login should work!' : 'NO - Passwords dont match');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
