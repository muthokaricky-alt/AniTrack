import jwt from 'jsonwebtoken';

// One place that makes login tokens. `user` is a full row from the users table.
export function signToken(user) {
  return jwt.sign({ userId: user.id, v: user.token_version }, process.env.JWT_SECRET, { expiresIn: '7d' });
}
