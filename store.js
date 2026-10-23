import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

export function failure(message, status = 400) { return Object.assign(new Error(message), { status }); }
const conflict = () => failure('다른 친구가 먼저 수정했어요. 최신 내용을 확인하고 다시 해주세요.', 409);

// Local files are for development only; production never falls back to ephemeral disk.
export function createFileStore(directory) {
  return {
    async get(id) {
      try { return JSON.parse(await readFile(path.join(directory, id + '.json'), 'utf8')); }
      catch (e) { if (e.code === 'ENOENT') throw failure('방을 찾을 수 없어요. 링크를 확인해주세요.', 404); throw e; }
    },
    async save(id, state, expectedVersion) {
      if (expectedVersion !== undefined && (await this.get(id)).version !== expectedVersion) throw conflict();
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, id + '.tmp'), JSON.stringify(state), { mode: 0o600 });
      await rename(path.join(directory, id + '.tmp'), path.join(directory, id + '.json'));
    }
  };
}

export function createSupabaseStore({ url, key, fetchImpl = fetch }) {
  let base;
  try { base = new URL(url); } catch { throw new Error('SUPABASE_URL must be a Supabase project HTTPS URL.'); }
  if (base.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(base.hostname) || base.port || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
    throw new Error('SUPABASE_URL must be https://<project-ref>.supabase.co');
  }
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.');
  async function request(query, method = 'GET', data) {
    let response;
    try {
      response = await fetchImpl(new URL('/rest/v1/approval_rooms' + query, base), {
        method,
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: data === undefined ? undefined : JSON.stringify(data),
        signal: AbortSignal.timeout(15000)
      });
    } catch { throw failure('기록 저장소에 연결할 수 없어요. 잠시 후 다시 시도해주세요.', 503); }
    if (!response.ok) throw failure('기록 저장소를 사용할 수 없어요. 관리자에게 문의해주세요.', 503);
    return response.json();
  }
  return {
    async get(id) {
      const rows = await request(`?id=eq.${id}&select=state`);
      if (!rows.length) throw failure('방을 찾을 수 없어요. 링크를 확인해주세요.', 404);
      return rows[0].state;
    },
    async save(id, state, expectedVersion) {
      if (expectedVersion === undefined) {
        await request('', 'POST', { id, version: state.version, state });
      } else {
        // One atomic database statement: two instances cannot approve the same revision.
        const rows = await request(`?id=eq.${id}&version=eq.${expectedVersion}`, 'PATCH', { state, version: state.version });
        if (!rows.length) throw conflict();
      }
    }
  };
}
