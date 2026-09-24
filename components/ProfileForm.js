'use client';

import { useState } from 'react';
import { createClient } from '../lib/supabase/client';

const TOGGLES = [
  { key: 'retro_reminders', label: 'Напоминания о ретро', hint: 'Сообщать за час до начала запланированной ретро-сессии.' },
  { key: 'issue_updates', label: 'Обновления по проблемам', hint: 'Сообщать, когда проблема, за которую я отвечаю, меняет статус.' },
  { key: 'weekly_digest', label: 'Еженедельный дайджест', hint: 'Короткое письмо по понедельникам с итогами прошлой недели.' },
];

export default function ProfileForm({ profile }) {
  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [role, setRole] = useState(profile.role || '');
  const [prefs, setPrefs] = useState(profile.notification_prefs || {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim(), role: role.trim(), notification_prefs: prefs })
      .eq('id', profile.id);
    setSaving(false);
    if (updateError) {
      setError('Не удалось сохранить. Попробуйте ещё раз.');
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function toggle(key) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }

  return (
    <form onSubmit={handleSave}>
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div className="micro-label" style={{ marginBottom: 14 }}>Личные данные</div>
        <div className="field">
          <label htmlFor="display-name">Имя</label>
          <input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div className="field">
          <label htmlFor="role">Роль в студии</label>
          <input id="role" value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Почта</label>
          <div style={{ fontSize: 13.5, color: 'var(--gray-2)' }}>{profile.email}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div className="micro-label" style={{ marginBottom: 14 }}>Уведомления</div>
        {TOGGLES.map((t) => (
          <div key={t.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--divider)' }}>
            <div style={{ marginRight: 16 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{t.label}</div>
              <div style={{ fontSize: 12, color: 'var(--gray-2)', marginTop: 2 }}>{t.hint}</div>
            </div>
            <button
              type="button"
              className={`toggle${prefs[t.key] ? ' on' : ''}`}
              onClick={() => toggle(t.key)}
              aria-pressed={!!prefs[t.key]}
              aria-label={t.label}
            >
              <span className="knob" />
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Сохраняем…' : 'Сохранить изменения'}
        </button>
        {saved && <span style={{ fontSize: 12, color: 'var(--ok-fg)' }}>Сохранено</span>}
        {error && <span style={{ fontSize: 12, color: 'var(--err-fg)' }}>{error}</span>}
      </div>
    </form>
  );
}
