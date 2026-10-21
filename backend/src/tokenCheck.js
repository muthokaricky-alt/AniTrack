// Decides whether a login token still belongs to the account it names.
// A token only says "I am user #N". Without this check, number N could point at a different person than it did when
// the token was made (for example after the database was reset, migrated or recreated), or at nobody at all.
export function tokenMatchesUser(payload, user) {
  if (!payload || !user) return false; // token is garbage, or the account no longer exists
  // Every token carries the account's "token version". Changing a password or pressing "log out other devices" bumps it,
  // which cancels every older token. Tokens made before this check existed have no version, so they are refused too.
  if (!Number.isInteger(payload.v) || payload.v !== user.token_version) return false;
  const issuedAt = Number(payload.iat) * 1000;
  if (user.created_at == null) return false; // new Date(null) would be 1970 and wave everything through
  const created = new Date(user.created_at).getTime();
  if (!Number.isFinite(issuedAt) || !Number.isFinite(created)) return false;
  // A token made before this account existed can't be this account's. (5 seconds of slack: iat is rounded down to the second.)
  return issuedAt >= created - 5000;
}
