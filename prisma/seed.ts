import { PrismaClient } from '../node_modules/.prisma/client-custom-v8';

const prisma = new PrismaClient();

async function main() {
  console.log('Syncing schedule templates (preserving existing data)...');

  const templates = [
    { dayOfWeek: 1, subject: 'Networking Fundamentals', startTime: '20:00', endTime: '20:30', deadlineDay: 'Monday', type: 'HOMEWORK' },
    { dayOfWeek: 1, subject: 'Develop Web Application Using JavaScript', startTime: '20:30', endTime: '21:30', deadlineDay: 'Monday', type: 'HOMEWORK' },
    { dayOfWeek: 1, subject: 'Design Embedded Systems Hardware', startTime: '20:00', endTime: '20:30', deadlineDay: 'Tuesday', type: 'HOMEWORK' },
    { dayOfWeek: 2, subject: 'Design Web Application Using PHP', startTime: '20:00', endTime: '21:30', deadlineDay: 'Wednesday', type: 'HOMEWORK' },
    { dayOfWeek: 2, subject: 'ENTREPRENEURSHIP', startTime: '21:30', endTime: '22:00', deadlineDay: 'Tuesday', type: 'HOMEWORK' },
    { dayOfWeek: 2, subject: 'ENGLISH', startTime: '22:00', endTime: '23:30', deadlineDay: 'Tuesday', type: 'HOMEWORK' },
    { dayOfWeek: 3, subject: 'Physics (Design electrical and electronic circuit using optical instruments)', startTime: '19:00', endTime: '21:30', deadlineDay: 'Friday', type: 'HOMEWORK' },
    { dayOfWeek: 3, subject: 'Develop Basic Database', startTime: '21:30', endTime: '22:30', deadlineDay: 'Thursday', type: 'HOMEWORK' },
    { dayOfWeek: 3, subject: 'Foundamentals of Programming using C', startTime: '22:30', endTime: '23:30', deadlineDay: 'Thursday', type: 'HOMEWORK' },
    { dayOfWeek: 4, subject: 'Math (Apply Algebra, Trigonometry, Probability, and Statistics)', startTime: '19:00', endTime: '21:30', deadlineDay: 'Sunday', type: 'HOMEWORK' },
    { dayOfWeek: 4, subject: 'Design Web User Interface', startTime: '21:30', endTime: '22:30', deadlineDay: 'Thursday', type: 'HOMEWORK' },
    { dayOfWeek: 4, subject: 'Physics (Design electrical and electronic circuit using optical instruments)', startTime: '22:30', endTime: '00:00', deadlineDay: 'Thursday', type: 'HOMEWORK' },
    { dayOfWeek: 5, subject: 'Math (Apply Algebra, Trigonometry, Probability, and Statistics)', startTime: '20:00', endTime: '21:30', deadlineDay: 'Friday', type: 'REVISION' },
    { dayOfWeek: 5, subject: 'Foundamentals of Programming using C', startTime: '21:30', endTime: '22:30', deadlineDay: 'Friday', type: 'REVISION' },
    { dayOfWeek: 5, subject: 'Physics (Design electrical and electronic circuit using optical instruments)', startTime: '22:30', endTime: '00:00', deadlineDay: 'Friday', type: 'REVISION' },
    { dayOfWeek: 6, subject: 'Develop Web Application Using JavaScript', startTime: '18:00', endTime: '20:30', deadlineDay: 'Saturday', type: 'REVISION' },
    { dayOfWeek: 6, subject: 'Physics (Design electrical and electronic circuit using optical instruments)', startTime: '20:30', endTime: '22:00', deadlineDay: 'Saturday', type: 'REVISION' },
    { dayOfWeek: 0, subject: 'Design Embedded Systems Hardware', startTime: '19:00', endTime: '20:30', deadlineDay: 'Sunday', type: 'REVISION' },
    { dayOfWeek: 0, subject: 'Design Web Application Using PHP', startTime: '20:30', endTime: '22:00', deadlineDay: 'Sunday', type: 'REVISION' },
  ];

  for (const template of templates) {
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: { username: 'demo', passwordHash: 'dummy', isAdmin: true }
      });
    }

    // Check if a template for this specific time/day/subject already exists
    const exists = await prisma.scheduleTemplate.findFirst({
      where: {
        userId: user.id,
        dayOfWeek: template.dayOfWeek,
        subject: template.subject,
        startTime: template.startTime
      }
    });

    if (!exists) {
      await prisma.scheduleTemplate.create({ data: { ...template, userId: user.id } });
      console.log(`+ Added missing template: ${template.subject} (${template.startTime})`);
    }
  }

  console.log('Seed/Sync completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });