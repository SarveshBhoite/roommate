import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'roommate_dev_secret_key';

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
  roomId?: string;
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '30d',
  });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as unknown as JWTPayload;
}
