'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) return;
    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) {
      setError('Неверная почта или пароль. Уточните данные у того, кто выдал доступ.');
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="micro-label" style={{ marginBottom: 10 }}>ze.studio</div>
        <h1>Журнал студии</h1>
        <p className="sub">Вход по email и паролю, которые вам выдали.</p>

        <form onSubmit={handleSubmit}>
          {error && <div className="err">{error}</div>}
          <div className="field">
            <label htmlFor="login-email">Рабочая почта</label>
            <input
              id="login-email"
              type="email"
              required
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">Пароль</label>
            <input
              id="login-password"
              type="password"
              required
              placeholder="Пароль, который вам выдали"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Входим…' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
