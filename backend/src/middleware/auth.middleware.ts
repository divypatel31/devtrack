import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthUserPayload {
  id: string;
  email: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

export function signAuthToken(user: AuthUserPayload): string {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '7d' }
  );
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as {
      sub?: string;
      email?: string;
      name?: string;
    };

    if (!decoded.sub || !decoded.email) {
      res.status(401).json({ error: 'Invalid or expired authentication token.' });
      return;
    }

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name || 'Developer',
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}