import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { apiCall } from '../helpers';

describe('Notes API', () => {
  let token: string;
  let exerciseId: string;
  let noteId: string;
  const testId = Date.now().toString(36) + 'not';
  const user = {
    email: `notes-test-${testId}@cmgym-test.dev`,
    password: 'NotesTest123!',
    display_name: `Notes Tester`,
  };

  beforeAll(async () => {
    const res = await apiCall('/auth/register', { method: 'POST', body: user, token: null });
    token = res.data.token;
    const ex = await apiCall('/exercises/fetch-external', {
      method: 'POST',
      body: { name: 'deadlift', limit: 1 },
      token,
    });
    const data = Array.isArray(ex.data) ? ex.data : (ex.raw?.data || []);
    if (data.length > 0) exerciseId = data[0].id;
  });

  afterAll(async () => {
    if (token) await apiCall('/users/me', { method: 'DELETE', token });
  });

  it('GET /notes — returns notes list', async () => {
    const res = await apiCall('/notes', { token });
    expect(res.status).toBe(200);
  });

  it('POST /notes — creates a note', async () => {
    if (!exerciseId) return;
    const res = await apiCall('/notes', {
      method: 'POST',
      body: { exercise_id: exerciseId, body: 'Keep back straight, brace core' },
      token,
    });
    expect(res.status).toBe(201);
    noteId = res.data.id;
  });

  it('PATCH /notes/:id — updates a note', async () => {
    if (!noteId) return;
    const res = await apiCall(`/notes/${noteId}`, {
      method: 'PATCH',
      body: { body: 'Updated: focus on hip hinge' },
      token,
    });
    expect(res.status).toBe(200);
    expect(res.data.body).toBe('Updated: focus on hip hinge');
  });

  it('DELETE /notes/:id — deletes a note', async () => {
    if (!noteId) return;
    const res = await apiCall(`/notes/${noteId}`, { method: 'DELETE', token });
    expect(res.status).toBe(204);
  });
});
