import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { createAdminClient } from '../../../lib/supabase/admin';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Не авторизовано.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Приглашать могут только админы.' }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Некорректный запрос.' }, { status: 400 });
  }

  const email = (body?.email || '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Введите корректный email.' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: 'Приглашения не настроены: на сервере не задан SUPABASE_SERVICE_ROLE_KEY.' },
      { status: 500 }
    );
  }

  const { origin } = new URL(request.url);
  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/set-password`,
  });

  if (inviteError) {
    const message = /already registered|already been registered/i.test(inviteError.message)
      ? 'Этот человек уже зарегистрирован.'
      : 'Не удалось отправить приглашение. Попробуйте ещё раз.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
