'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Pill from './Pill';
import { createClient } from '../lib/supabase/client';
import { SEVERITY_LABEL, SEVERITY_PILL_CLASS } from '../lib/retro-constants';

export default function IssueRow({ issue }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const resolved = issue.status === 'resolved';

  async function toggleStatus() {
    setBusy(true);
    const supabase = createClient();
    const nextStatus = resolved ? 'open' : 'resolved';
    await supabase
      .from('issues')
      .update({ status: nextStatus, resolved_at: nextStatus === 'resolved' ? new Date().toISOString() : null })
      .eq('id', issue.id);

    if (nextStatus === 'resolved') {
      await supabase.from('events').insert({
        project_id: issue.project_id,
        type: 'issue_resolved',
        title: `Проблема «${issue.title}» помечена решённой`,
        subtitle: null,
      });
    }

    setBusy(false);
    router.refresh();
  }

  return (
    <div id={issue.id} className="list-row card-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ flex: 1 }}>
        <div className="row-title">{issue.title}</div>
        <div className="row-sub">
          {issue.projects?.name || '—'}
          {issue.description ? ` · ${issue.description}` : ''}
        </div>
      </div>
      <Pill variant={SEVERITY_PILL_CLASS[issue.severity]?.replace('pill-', '') || 'neutral'}>
        {SEVERITY_LABEL[issue.severity]}
      </Pill>
      <button type="button" className="btn btn-secondary btn-sm" onClick={toggleStatus} disabled={busy}>
        {busy ? '…' : resolved ? 'Вернуть' : 'Решено'}
      </button>
    </div>
  );
}
