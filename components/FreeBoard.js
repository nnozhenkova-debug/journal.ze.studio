'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '../lib/supabase/client';
import '@excalidraw/excalidraw/index.css';

// Excalidraw использует canvas/DOM API и не поддерживает серверный рендер —
// подключаем его только на клиенте.
const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
  { ssr: false, loading: () => <div className="free-board-loading">Загружаем доску…</div> }
);

const SAVE_DEBOUNCE_MS = 1200;

// Свободная доска ретро («Свободная доска» / boardType: 'freeform').
// В отличие от остальных шаблонов, здесь нет колонок и заметок в БД —
// всё содержимое доски (фигуры, стикеры, текст) хранится одним jsonb-полем
// retros.board_data и автосохраняется с задержкой после каждого изменения.
// Между открытыми вкладками разных участников синхронизация «почти живая»:
// подписка на обновление той же строки retros подхватывает чужие сохранения.
export default function FreeBoard({ retroId, initialBoardData, readOnly }) {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const saveTimerRef = useRef(null);
  const lastSyncedRef = useRef(JSON.stringify(initialBoardData?.elements || []));
  const applyingRemoteRef = useRef(false);
  const supabaseRef = useRef(null);

  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    return supabaseRef.current;
  }, []);

  const saveElements = useCallback(
    async (elements) => {
      const serialized = JSON.stringify(elements);
      if (serialized === lastSyncedRef.current) return;
      lastSyncedRef.current = serialized;
      const supabase = getSupabase();
      const { error } = await supabase
        .from('retros')
        .update({ board_data: { elements } })
        .eq('id', retroId);
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[retros board_data update]', error);
      }
    },
    [retroId, getSupabase]
  );

  const handleChange = useCallback(
    (elements) => {
      if (readOnly || applyingRemoteRef.current) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveElements(elements), SAVE_DEBOUNCE_MS);
    },
    [readOnly, saveElements]
  );

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (!excalidrawAPI || readOnly) return undefined;
    const supabase = getSupabase();
    const channel = supabase
      .channel(`retro-board-${retroId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'retros', filter: `id=eq.${retroId}` },
        (payload) => {
          const incoming = payload.new?.board_data;
          if (!incoming) return;
          const serialized = JSON.stringify(incoming.elements || []);
          if (serialized === lastSyncedRef.current) return; // это эхо нашего же сохранения
          lastSyncedRef.current = serialized;
          applyingRemoteRef.current = true;
          excalidrawAPI.updateScene({ elements: incoming.elements || [] });
          applyingRemoteRef.current = false;
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [excalidrawAPI, readOnly, retroId, getSupabase]);

  return (
    <div className={`free-board-wrap${readOnly ? ' is-readonly' : ''}`}>
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        initialData={{
          elements: initialBoardData?.elements || [],
          // Excalidraw needs a literal hex for its canvas — can't resolve a CSS var here.
          // Mirrors --surface-warm in app/globals.css; keep the two in sync by hand.
          appState: { viewBackgroundColor: '#faf8f4' },
          scrollToContent: true,
        }}
        onChange={handleChange}
        viewModeEnabled={readOnly}
        theme="light"
        UIOptions={{ canvasActions: { toggleTheme: false } }}
      />
    </div>
  );
}
