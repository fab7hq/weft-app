// Every statement the service runs, in one place, so a test can check that
// each goes through a key or an index: D1 counts rows scanned (account.md §6).

export const SQL = {
  upsertUser: `INSERT INTO users (id, github_id, login, created_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (github_id) DO UPDATE SET login = excluded.login RETURNING id`,
  startSession: 'INSERT INTO sessions (hash, user_id, expires_at) VALUES (?, ?, ?)',
  session: `SELECT s.user_id AS userId, s.expires_at AS expiresAt, s.minute, s.asserted,
      u.login, u.github_id AS githubId
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.hash = ?`,
  sweep: 'DELETE FROM sessions WHERE expires_at <= ?',
  addMachine: `INSERT INTO machines (id, user_id, name, token_hash, created_at) VALUES (?, ?, ?, ?, ?)`,
  machineByToken: 'SELECT id, user_id AS userId FROM machines WHERE token_hash = ?',
  setAddress: 'UPDATE machines SET address = ?, address_at = ? WHERE id = ?',
  machines: `SELECT id, name, address, address_at FROM machines WHERE user_id = ? ORDER BY created_at`,
  removeMachine: 'DELETE FROM machines WHERE id = ? AND user_id = ?',
  leave: 'DELETE FROM machines WHERE id = ?',
} as const;
