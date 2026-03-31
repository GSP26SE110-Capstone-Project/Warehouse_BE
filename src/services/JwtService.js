import jwt from 'jsonwebtoken';

const DEFAULT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const DEFAULT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';

function buildClaims(user) {
  return {
    userId: user.userId,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

export function signAccessToken(user) {
  return jwt.sign(buildClaims(user), DEFAULT_SECRET, {
    expiresIn: DEFAULT_EXPIRES_IN,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, DEFAULT_SECRET);
}

