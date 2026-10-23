import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function createAuth({ password, secret, secure = false, now = Date.now }) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 1024) throw new Error('APP_PASSWORD must contain at least 12 characters.');
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');
  const salt = randomBytes(16);
  const passwordHash = scryptSync(password, salt, 32);
  // Changing either secret invalidates all old cookies, including after a restart.
  const key = createHmac('sha256', secret).update(password).digest();
  const cookieName = secure ? '__Host-approval_session' : 'approval_session';
  const lifetime = 7 * 24 * 60 * 60;
  let failures = [];
  const sign = payload => createHmac('sha256', key).update(payload).digest('base64url');
  const cookie = (value, age) => `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secure ? '; Secure' : ''}`;
  return {
    login(input) {
      failures = failures.filter(at => at > now() - 15 * 60 * 1000);
      // Global limit cannot be bypassed with forged proxy/IP headers.
      if (failures.length >= 10) return { status: 429, error: '비밀번호 입력 시도가 많아요. 최대 15분 뒤 다시 시도해주세요.' };
      if (typeof input !== 'string' || input.length > 1024 || !timingSafeEqual(scryptSync(input, salt, 32), passwordHash)) {
        failures.push(now());
        return { status: 401, error: '입장 비밀번호가 맞지 않아요.' };
      }
      const payload = Buffer.from(JSON.stringify({ expires: now() + lifetime * 1000, nonce: randomBytes(16).toString('hex') })).toString('base64url');
      return { status: 200, cookie: cookie(`${payload}.${sign(payload)}`, lifetime) };
    },
    authenticated(req) {
      const value = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
      if (!value || value.length > 1024) return false;
      const parts = value.split('.');
      if (parts.length !== 2) return false;
      const [payload, signature] = parts;
      const expected = Buffer.from(sign(payload));
      const actual = Buffer.from(signature);
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
      try { return JSON.parse(Buffer.from(payload, 'base64url').toString()).expires > now(); } catch { return false; }
    },
    logoutCookie() { return cookie('', 0); }
  };
}
