// Script to safely clear all entries from the user_course table.
// Run with: `node scripts/clear-user-courses.js`
import 'dotenv/config';
import prisma from '../src/lib/prisma.js';

async function clear() {
  try {
    const count = await prisma.userCourse.count();
    console.log(`🧹 Found ${count} user_course records. Deleting…`);
    // Delete dependent attendances first to avoid FK violations
    await prisma.attendance.deleteMany();
    await prisma.userCourse.deleteMany();
    console.log('✅ All user_course records removed.');
  } catch (e) {
    console.error('❌ Error clearing user_course:', e);
  } finally {
    await prisma.$disconnect();
  }
}

clear();
