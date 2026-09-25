'use client';

import { useState } from 'react';
import Avatar from './Avatar';
import EmptyState from './EmptyState';
import { createClient } from '../lib/supabase/client';

export default function ProjectTeamCard({ projectId, initialMembers, teamProfiles, isAdmin }) {
  const [members, setMembers] = useState(initialMembers || []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedId, setPickedId] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const available = (teamProfiles || []).filter((tp) => !members.some((m) => m.id === tp.id));

  async function addMember() {
    if (!pickedId) return;
    setAdding(true);
    setError('');
    const supabase = createClient();
    const { error: insertError } = await supabase
      .from('project_members')
      .insert({ project_id: projectId, user_id: pickedId, sort_order: members.length });
    setAdding(false);
    if (!insertError) {
      const p = (teamProfiles || []).find((tp) => tp.id === pickedId);
      if (p) setMembers((prev) => [...prev, p]);
      setPickedId('');
      setPickerOpen(false);
    } else {
      // eslint-disable-next-line no-console
      console.error('[project_members insert]', insertError);
      setError('Не удалось добавить участника.');
    }
  }

  async function removeMember(userId) {
    setMembers((prev) => prev.filter((m) => m.id !== userId));
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);
    if (deleteError) {
      // eslint-disable-next-line no-console
      console.error('[project_members delete]', deleteError);
    }
  }

  return (
    <div className="side-card">
      <div className="side-card-head">
        <span className="micro-label">Команда проекта</span>
        {isAdmin && (
          <button type="button" className="prepare-change-template" onClick={() => setPickerOpen((v) => !v)}>
            {pickerOpen ? 'Отмена' : '+ Добавить'}
          </button>
        )}
      </div>

      {isAdmin && pickerOpen && (
        <div className="add-member-row">
          <select className="context-dropdown" value={pickedId} onChange={(e) => setPickedId(e.target.value)}>
            <option value="">Выберите человека</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addMember} disabled={!pickedId || adding}>
            {adding ? '…' : 'Добавить'}
          </button>
        </div>
      )}
      {error && <div className="err" style={{ margin: '0 22px 14px' }}>{error}</div>}

      {members.length === 0 ? (
        <div style={{ padding: '14px 22px' }}>
          <EmptyState>Участники ещё не добавлены.</EmptyState>
        </div>
      ) : (
        members.map((m) => (
          <div key={m.id} className="member-row">
            <Avatar id={m.id} name={m.display_name} url={m.avatar_url} size={36} />
            <div style={{ flex: 1 }}>
              <div className="member-name">{m.display_name}</div>
              {m.role && <div className="member-role">{m.role}</div>}
            </div>
            {isAdmin && (
              <button type="button" className="member-remove" onClick={() => removeMember(m.id)} title="Убрать из проекта">
                ×
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
