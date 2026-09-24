'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase/client';

export default function SetPasswordForm({ email }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Пароль должен быть не короче 8 символов.');
      return;
    }
    if (password !== confirm) {
      setError('Пароли не совпадают.');
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data: userData, error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setSaving(false);
      setError('Не удалось сохранить пароль. Попробуйте ещё раз.');
      return;
    }
    const userId = userData?.user?.id;
    if (userId) {
      await supabase.from('profiles').update({ status: 'active' }).eq('id', userId);
    }
    setSaving(false);
    router.push('/');
    router.refresh();
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="micro-label" style={{ marginBottom: 10 }}>ze.studio</div>
        <h1>Добро пожаловать<span style={{ color: 'var(--gold)' }}>.</span></h1>
        <p className="sub">
          {email ? `${email} — придумайте` : 'Придумайте'} пароль, чтобы завершить регистрацию.
        </p>

        <form onSubmit={handleSubmit}>
          {error && <div className="err">{error}</div>}
          <div className="field">
            <label htmlFor="new-password">Новый пароль</label>
            <input
              id="new-password"
              type="password"
              required
              placeholder="Минимум 8 символов"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label htmlFor="confirm-password">Повторите пароль</label>
            <input
              id="confirm-password"
              type="password"
              required
              placeholder="Ещё раз"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: '100%' }}>
            {saving ? 'Сохраняем…' : 'Продолжить'}
          </button>
        </form>
      </div>
    </div>
  );
}
