'use client';

import { useState } from 'react';
import { createClient } from '../lib/supabase/client';
import Avatar from './Avatar';
import SignOutButton from './SignOutButton';
import ErrorCard from './ErrorCard';
import { TIMEZONES } from '../lib/retro-constants';

const TOGGLES = [
  { key: 'retro_reminders', label: 'Уведомления о ретро', hint: 'Напоминание за час до начала' },
  { key: 'issue_updates', label: 'Открытые проблемы', hint: 'Когда появляется новая критичная проблема' },
  { key: 'weekly_digest', label: 'Еженедельный дайджест', hint: 'Сводка по почте по понедельникам' },
];

export default function ProfileForm({ profile }) {
  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [role, setRole] = useState(profile.role || '');
  const [timezone, setTimezone] = useState(profile.timezone || TIMEZONES[1]);
  const [prefs, setPrefs] = useState(profile.notification_prefs || {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  async function handleSave(e) {
    e?.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim(), role: role.trim(), timezone, notification_prefs: prefs })
      .eq('id', profile.id);
    setSaving(false);
    if (updateError) {
      setError(true);
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
      <div className="profile-hero">
        <Avatar id={profile.id} name={displayName || profile.email} size={64} />
        <div style={{ flex: 1 }}>
          <div className="profile-hero-name">{displayName || profile.email}</div>
          <div className="profile-hero-role">{role || 'Участник команды'} · ze.studio</div>
          <div className="profile-hero-email">{profile.email}</div>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" disabled title="Загрузка фото появится позже">
          Изменить фото
        </button>
      </div>

      <div className="micro-label" style={{ marginTop: 24, marginBottom: 14 }}>Данные аккаунта</div>
      <div className="field-grid">
        <div className="field-box">
          <label htmlFor="display-name">Имя</label>
          <input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="field-box">
          <label htmlFor="role">Роль</label>
          <input id="role" value={role} onChange={(e) => setRole(e.target.value)} />
        </div>
        <div className="field-box">
          <label>Email</label>
          <div className="field-box-value">{profile.email}</div>
        </div>
        <div className="field-box">
          <label htmlFor="timezone">Часовой пояс</label>
          <select id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="micro-label" style={{ marginTop: 24, marginBottom: 14 }}>Уведомления</div>
      <div className="toggle-list">
        {TOGGLES.map((t) => (
          <div key={t.key} className="toggle-row">
            <div style={{ flex: 1 }}>
              <div className="toggle-row-title">{t.label}</div>
              <div className="toggle-row-hint">{t.hint}</div>
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

      {error && (
        <div style={{ marginTop: 24 }}>
          <ErrorCard onRetry={handleSave} retrying={saving} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 24 }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Сохраняем…' : 'Сохранить изменения'}
        </button>
        <SignOutButton className="signout-link">Выйти из аккаунта</SignOutButton>
        {saved && <span style={{ fontSize: 12, color: 'var(--ok-fg)' }}>Сохранено</span>}
      </div>
    </form>
  );
}
