const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('\n📋 Faculty Users:');
  const faculty = await prisma.users.findMany({
    where: { role: 'faculty' },
    select: { email: true, displayName: true, id: true }
  });
  console.log(faculty);

  console.log('\n📋 All User Roles:');
  const roles = await prisma.users.groupBy({
    by: ['role'],
    _count: { role: true }
  });
  console.log(roles);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
