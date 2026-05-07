import { query } from '../db.js';
import { generateWeekSchedule } from '@fitflow/core';

/**
 * SOP 6.5: Auto-generate next week's sessions for all active programmes.
 * Runs Sunday night for the coming Monday.
 */
export async function generateWeeklySchedules(): Promise<void> {
  // Find all active programmes
  const programmes = await query(
    `SELECT gp.*, us.rest_between_sets_s
     FROM generated_programmes gp
     LEFT JOIN user_settings us ON gp.owner_id = us.user_id AND gp.owner_type = 'user'
     WHERE gp.is_active = true`
  );

  const monday = new Date();
  monday.setDate(monday.getDate() + (1 + 7 - monday.getDay()) % 7); // next Monday

  for (const prog of programmes.rows) {
    // Fetch exercise pools for this programme's owner
    const pools = await query(
      `SELECT ep.*, e.avg_duration_s, e.name, e.type, mf.code as family_code
       FROM exercise_pools ep
       JOIN exercises e ON ep.exercise_id = e.id
       LEFT JOIN muscle_families mf ON ep.muscle_family_id = mf.id
       WHERE ep.owner_type = $1 AND ep.owner_id = $2`,
      [prog.owner_type, prog.owner_id]
    );

    if (pools.rows.length === 0) {
      console.log(`[GenerateSchedules] Skipping programme ${prog.id} — empty pool.`);
      continue;
    }

    const schedule = generateWeekSchedule({
      sessionsPerWeek: prog.sessions_per_week,
      sessionDurationMin: prog.session_duration_min,
      cardioDurationMin: prog.cardio_duration_min,
      restBetweenSetsS: prog.rest_between_sets_s ?? 90,
      exercisePools: pools.rows,
    });

    // Get latest week number
    const latest = await query(
      'SELECT COALESCE(MAX(week_number), 0) as max_week FROM generated_sessions WHERE programme_id = $1',
      [prog.id]
    );
    const nextWeek = parseInt(latest.rows[0].max_week) + 1;

    for (let day = 0; day < schedule.length; day++) {
      const sessionDate = new Date(monday);
      sessionDate.setDate(monday.getDate() + day);

      await query(
        `INSERT INTO generated_sessions (programme_id, week_number, day_number, session_date, schedule_json)
         VALUES ($1, $2, $3, $4, $5)`,
        [prog.id, nextWeek, day + 1, sessionDate.toISOString().split('T')[0], JSON.stringify(schedule[day])]
      );
    }

    console.log(`[GenerateSchedules] Programme ${prog.id}: ${schedule.length} sessions for week ${nextWeek}.`);
  }
}
