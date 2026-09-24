'use client';

import { useState } from 'react';
import { createClient } from '../../lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim()) return;
    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (signInError) {
      setError(
        signInError.message.includes('ze.studio')
          ? signInError.message
          : 'Не получилось отправить ссылку. Проверьте адрес и попробуйте ещё раз.'
      );
      return;
    }
    setSent(true);
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="eyebrow">ze.studio</div>
        <h1>Журнал студии</h1>
        <p>Вход по ссылке на почту — без пароля. Доступ только с адресов @ze.studio.</p>

        {sent ? (
          <div className="ok">
            Письмо со ссылкой для входа отправлено на {email}. Откройте его и перейдите по ссылке —
            вас вернёт сюда уже авторизованным.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div className="err">{error}</div>}
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="login-email">Рабочая почта</label>
              <input
                id="login-email"
                type="email"
                required
                placeholder="имя@ze.studio"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <button type="submit" className="btn" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Отправляем…' : 'Прислать ссылку для входа'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
