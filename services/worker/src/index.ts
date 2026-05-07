import 'dotenv/config';
import cron from 'node-cron';
import { generateWeeklySchedules } from './jobs/generate-schedules.js';
import { computeReports } from './jobs/compute-reports.js';
import { computeLeaderboards } from './jobs/compute-leaderboards.js';

console.log('[Worker] FitFlow cron worker starting...');

// SOP 6.5: Generate new week on Sunday night at 23:00
cron.schedule('0 23 * * 0', async () => {
  console.log('[Cron] Running weekly schedule generation...');
  try {
    await generateWeeklySchedules();
    console.log('[Cron] Weekly schedules generated.');
  } catch (err) {
    console.error('[Cron] Schedule generation failed:', err);
  }
});

// SOP 14: Daily report at 23:59
cron.schedule('59 23 * * *', async () => {
  console.log('[Cron] Computing daily reports...');
  try {
    await computeReports('daily');
    console.log('[Cron] Daily reports done.');
  } catch (err) {
    console.error('[Cron] Daily report failed:', err);
  }
});

// SOP 14: Weekly report on Sunday at 23:59
cron.schedule('59 23 * * 0', async () => {
  console.log('[Cron] Computing weekly reports...');
  try {
    await computeReports('weekly');
    console.log('[Cron] Weekly reports done.');
  } catch (err) {
    console.error('[Cron] Weekly report failed:', err);
  }
});

// SOP 14: Monthly report on last day of month at 23:59
cron.schedule('59 23 28-31 * *', async () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (tomorrow.getDate() === 1) {
    console.log('[Cron] Computing monthly reports...');
    try {
      await computeReports('monthly');
      console.log('[Cron] Monthly reports done.');
    } catch (err) {
      console.error('[Cron] Monthly report failed:', err);
    }
  }
});

// SOP 9.4: Family leaderboard on Sunday at 23:30
cron.schedule('30 23 * * 0', async () => {
  console.log('[Cron] Computing family leaderboards...');
  try {
    await computeLeaderboards();
    console.log('[Cron] Leaderboards done.');
  } catch (err) {
    console.error('[Cron] Leaderboard computation failed:', err);
  }
});

console.log('[Worker] Cron jobs registered. Waiting for triggers...');
