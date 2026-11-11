// Decides whether a login token still belongs to the account it names.
// A token only says "I am user #N". Without this check, number N could point at a different person than it did when
// the token was made (for example after the database was reset, migrated or recreated), or at nobody at all.
export function tokenMatchesUser(payload, user) {
  if (!payload || !user) return false;
  if (!Number.isInteger(payload.v) || payload.v !== user.token_version) return false;
  const issuedAt = Number(payload.iat) * 1000;
  if (user.created_at == null) return false;
  const created = new Date(user.created_at).getTime();
  if (!Number.isFinite(issuedAt) || !Number.isFinite(created)) return false;
  return issuedAt >= created - 5000;
}
