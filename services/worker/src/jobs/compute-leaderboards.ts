import { query } from '../db.js';

/**
 * SOP 9.4: Compute family leaderboards weekly.
 * Auto-computed Sunday night from family_ledger.
 */
export async function computeLeaderboards(): Promise<void> {
  const families = await query('SELECT id, name FROM families');

  for (const family of families.rows) {
    const leaderboard = await query(
      `SELECT fl.user_id, u.display_name,
         SUM(fl.reps * fl.weight_kg) as total_volume,
         COUNT(DISTINCT DATE(fl.logged_at)) as session_days
       FROM family_ledger fl
       JOIN users u ON fl.user_id = u.id
       WHERE fl.family_id = $1 AND fl.logged_at >= DATE_TRUNC('week', CURRENT_DATE)
       GROUP BY fl.user_id, u.display_name
       ORDER BY total_volume DESC`,
      [family.id]
    );

    if (leaderboard.rows.length > 0) {
      const winner = leaderboard.rows[0];
      console.log(
        `[Leaderboard] Family "${family.name}": winner is ${winner.display_name} with ${winner.total_volume}kg`
      );
      // TODO: Send push notification to winner (confetti!)
    }
  }
}
