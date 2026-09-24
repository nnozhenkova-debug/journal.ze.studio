'use client';

import { useRef, useState } from 'react';
import { createClient } from '../lib/supabase/client';
import Avatar from './Avatar';
import SignOutButton from './SignOutButton';
import ErrorCard from './ErrorCard';
import { TIMEZONES } from '../lib/retro-constants';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

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
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const fileInputRef = useRef(null);

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

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError('Нужен файл PNG, JPEG, WebP или GIF.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('Файл больше 5 МБ — выберите фото поменьше.');
      return;
    }

    setAvatarError('');
    setUploadingAvatar(true);
    const supabase = createClient();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${profile.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, cacheControl: '3600' });

    if (uploadError) {
      setUploadingAvatar(false);
      setAvatarError('Не удалось загрузить фото. Попробуйте ещё раз.');
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const freshUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: freshUrl })
      .eq('id', profile.id);

    setUploadingAvatar(false);
    if (updateError) {
      setAvatarError('Фото загрузилось, но не сохранилось в профиле. Попробуйте ещё раз.');
      return;
    }
    setAvatarUrl(freshUrl);
  }

  return (
    <form onSubmit={handleSave}>
      <div className="profile-hero">
        <Avatar id={profile.id} name={displayName || profile.email} url={avatarUrl} size={64} />
        <div style={{ flex: 1 }}>
          <div className="profile-hero-name">{displayName || profile.email}</div>
          <div className="profile-hero-role">{role || 'Участник команды'} · ze.studio</div>
          <div className="profile-hero-email">{profile.email}</div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleAvatarChange}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingAvatar}
        >
          {uploadingAvatar ? 'Загружаем…' : 'Изменить фото'}
        </button>
      </div>
      {avatarError && <div className="err" style={{ marginTop: 8 }}>{avatarError}</div>}

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
