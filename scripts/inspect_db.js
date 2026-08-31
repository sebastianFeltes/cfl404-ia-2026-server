import prisma from '../src/lib/prisma.js';

async function run() {
  const users = await prisma.user.findMany();
  console.log('Users count:', users.length);
  const instructors = await prisma.user.findMany({ where: { roleId: 7 } });
  console.log('Instructors:', instructors.map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, email: u.email })));
  
  const statuses = await prisma.status.findMany();
  console.log('Statuses:', statuses);

  const courses = await prisma.course.findMany({
    include: {
      courseDetail: true
    }
  });
  console.log('Existing courses:', courses.map(c => ({ id: c.id, name: c.name })));
  
  await prisma.$disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
