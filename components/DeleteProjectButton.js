'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase/client';

export default function DeleteProjectButton({ projectId, projectName, isAdmin }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  if (!isAdmin) return null;

  async function handleDelete() {
    setDeleting(true);
    setError('');
    const supabase = createClient();
    const { error: deleteError } = await supabase.from('projects').delete().eq('id', projectId);
    if (deleteError) {
      // eslint-disable-next-line no-console
      console.error('[projects delete]', deleteError);
      setDeleting(false);
      setError('Не удалось удалить проект. Попробуйте ещё раз.');
      return;
    }
    router.push('/projects');
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="delete-project-confirm">
        <span>Удалить «{projectName}» безвозвратно, вместе с этапами и ретро?</span>
        <div className="delete-project-confirm-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirming(false)} disabled={deleting}>
            Отмена
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Удаляем…' : 'Да, удалить'}
          </button>
        </div>
        {error && <div className="err" style={{ marginTop: 8 }}>{error}</div>}
      </div>
    );
  }

  return (
    <button type="button" className="project-delete-trigger" onClick={() => setConfirming(true)}>
      Удалить проект
    </button>
  );
}
