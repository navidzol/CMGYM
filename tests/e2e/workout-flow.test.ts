import { describe, it, expect } from 'vitest';
import { apiCall } from '../helpers';

/**
 * End-to-end test: Full workout flow
 * register → seed exercises → add to pool → create programme → generate sessions → start workout → log sets → finish
 */
describe('E2E: Full Workout Flow', () => {
  const testId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const user = {
    email: `e2e-${testId}@cmgym-test.dev`,
    password: 'E2eTest123!',
    display_name: `E2E Tester ${testId}`,
  };
  let token: string;
  let exerciseIds: string[] = [];
  let programmeId: string;
  let generatedSessionId: string;
  let workoutSessionId: string;

  it('1. Register a new user', async () => {
    const res = await apiCall('/auth/register', {
      method: 'POST',
      body: user,
      token: null,
    });
    expect(res.status).toBe(201);
    token = res.data.token;
    expect(token).toBeTruthy();
  });

  it('2. Fetch exercises from ExerciseDB', async () => {
    // Fetch a few different exercises for different muscle groups
    for (const name of ['bench press', 'squat', 'deadlift', 'bicep curl', 'plank', 'lunge']) {
      const res = await apiCall('/exercises/fetch-external', {
        method: 'POST',
        body: { name, limit: 2 },
        token,
      });
      expect(res.status).toBe(200);
      const data = Array.isArray(res.data) ? res.data : (res.raw?.data || []);
      for (const ex of data) {
        if (!exerciseIds.includes(ex.id)) exerciseIds.push(ex.id);
      }
    }
    expect(exerciseIds.length).toBeGreaterThan(0);
  });

  it('3. Add exercises to pool', async () => {
    let added = 0;
    for (const id of exerciseIds.slice(0, 6)) {
      const res = await apiCall('/pools', {
        method: 'POST',
        body: { exercise_id: id },
        token,
      });
      if (res.status === 201) added++;
    }
    expect(added).toBeGreaterThan(0);
  });

  it('4. Create a programme', async () => {
    const res = await apiCall('/programmes', {
      method: 'POST',
      body: {
        weeks: 1,
        sessions_per_week: 3,
        session_duration_min: 30,
        cardio_duration_min: 5,
      },
      token,
    });
    expect(res.status).toBe(201);
    programmeId = res.data.id;
    expect(programmeId).toBeTruthy();
  });

  it('5. Generate sessions for programme', async () => {
    const res = await apiCall(`/programmes/${programmeId}/generate`, {
      method: 'POST',
      token,
    });
    expect(res.status).toBe(201);
    expect(res.data.sessions_generated).toBeGreaterThan(0);
  });

  it('6. Get generated sessions', async () => {
    const res = await apiCall(`/programmes/${programmeId}`, { token });
    expect(res.status).toBe(200);
    expect(res.data.sessions.length).toBeGreaterThan(0);
    generatedSessionId = res.data.sessions[0].id;
  });

  it('7. Start a workout from generated session', async () => {
    const res = await apiCall('/sessions', {
      method: 'POST',
      body: { generated_session_id: generatedSessionId, mode: 'standard' },
      token,
    });
    expect(res.status).toBe(201);
    workoutSessionId = res.data.id;
    expect(workoutSessionId).toBeTruthy();
  });

  it('8. Log sets in the workout', async () => {
    if (!exerciseIds[0]) return;

    // Log 3 sets
    for (let setNum = 1; setNum <= 3; setNum++) {
      const res = await apiCall(`/sessions/${workoutSessionId}/sets`, {
        method: 'POST',
        body: {
          exercise_id: exerciseIds[0],
          set_number: setNum,
          reps: 10,
          weight_kg: 60,
          rpe: 7,
        },
        token,
      });
      expect(res.status).toBe(201);
      expect(res.data.set_number).toBe(setNum);
    }
  });

  it('9. Get sets for the workout', async () => {
    const res = await apiCall(`/sessions/${workoutSessionId}/sets`, { token });
    expect(res.status).toBe(200);
    const sets = Array.isArray(res.data) ? res.data : [];
    expect(sets.length).toBe(3);
  });

  it('10. Check for personal records', async () => {
    const res = await apiCall('/records', { token });
    expect(res.status).toBe(200);
    // Should have at least one PR from logging sets
    const records = Array.isArray(res.data) ? res.data : [];
    expect(records.length).toBeGreaterThan(0);
  });

  it('11. Finish the workout', async () => {
    const res = await apiCall(`/sessions/${workoutSessionId}`, {
      method: 'PATCH',
      body: { notes: 'E2E test completed successfully' },
      token,
    });
    expect(res.status).toBe(200);
    expect(res.data.finished_at).toBeTruthy();
  });

  it('12. Generate a report', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await apiCall(`/reports?type=daily&date=${today}`, { token });
    expect(res.status).toBe(200);
    expect(Number(res.data.total_volume_kg)).toBeGreaterThan(0);
  });

  it('13. Cleanup: delete test user', async () => {
    const res = await apiCall('/users/me', { method: 'DELETE', token });
    expect(res.status).toBe(204);
  });
});
