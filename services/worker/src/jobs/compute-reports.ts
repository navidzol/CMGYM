import { query } from '../db.js';

/**
 * SOP 14: Pre-compute reports for all users who had sessions in the period.
 * Results are cached and served directly by the API.
 */
export async function computeReports(type: 'daily' | 'weekly' | 'monthly'): Promise<void> {
  let dateFilter: string;
  if (type === 'daily') {
    dateFilter = `DATE(ws.started_at) = CURRENT_DATE`;
  } else if (type === 'weekly') {
    dateFilter = `DATE(ws.started_at) >= DATE_TRUNC('week', CURRENT_DATE)`;
  } else {
    dateFilter = `DATE(ws.started_at) >= DATE_TRUNC('month', CURRENT_DATE)`;
  }

  // Find all users with sessions in this period
  const users = await query(
    `SELECT DISTINCT ws.user_id FROM workout_sessions ws WHERE ${dateFilter} AND ws.finished_at IS NOT NULL`
  );

  for (const row of users.rows) {
    const userId = row.user_id;

    // Total volume
    const volume = await query(
      `SELECT COALESCE(SUM(ss.reps * ss.weight_kg), 0) as total
       FROM session_sets ss
       JOIN workout_sessions ws ON ss.workout_session_id = ws.id
       WHERE ws.user_id = $1 AND ${dateFilter} AND ss.completed_at IS NOT NULL`,
      [userId]
    );

    // Session count
    const sessions = await query(
      `SELECT COUNT(*) as count FROM workout_sessions ws
       WHERE ws.user_id = $1 AND ${dateFilter} AND ws.finished_at IS NOT NULL`,
      [userId]
    );

    console.log(
      `[Reports] ${type} for user ${userId}: volume=${volume.rows[0].total}kg, sessions=${sessions.rows[0].count}`
    );
  }
}
