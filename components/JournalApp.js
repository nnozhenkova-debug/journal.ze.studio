'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '../lib/supabase/client';
import ItemRow from './ItemRow';
import {
  CATEGORIES,
  STATUS_LABEL,
  TYPE_LABEL,
  TYPE_GUIDE,
  catColor,
  colorForId,
  initials,
} from '../lib/journal-constants';

const TYPE_OPTIONS = Object.keys(TYPE_LABEL);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function JournalApp() {
  const supabase = useMemo(() => createClient(), []);
  const [me, setMe] = useState(null);
  const [profiles, setProfiles] = useState({});
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const [tab, setTab] = useState('feed');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  // filters
  const [feedFilters, setFeedFilters] = useState({ project: '', type: '', author: '' });
  const [retroFilters, setRetroFilters] = useState({ project: '', status: '' });

  // quick capture
  const [quickOpen, setQuickOpen] = useState(false);
  const [quick, setQuick] = useState({ type: 'note', project: '', text: '' });

  // new entry form
  const emptyForm = {
    type: 'meeting',
    project: '',
    date: todayStr(),
    attendees: '',
    category: 'brief',
    status: 'new',
    text: '',
    solution: '',
    owner: '',
    editingId: null,
  };
  const [form, setForm] = useState(emptyForm);

  // --- theme detection ---
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mq.matches);
    const handler = (e) => setIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // --- load current user + profiles + entries, subscribe realtime ---
  useEffect(() => {
    let channel;

    async function boot() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setMe(user);

      const { data: profileRows } = await supabase.from('profiles').select('id,email,display_name');
      const pmap = {};
      (profileRows || []).forEach((p) => {
        pmap[p.id] = p;
      });
      setProfiles(pmap);

      const { data: entryRows } = await supabase
        .from('entries')
        .select('*')
        .order('date', { ascending: false });
      setItems(entryRows || []);
      setLoading(false);

      channel = supabase
        .channel('entries-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, (payload) => {
          setItems((prev) => {
            if (payload.eventType === 'INSERT') {
              if (prev.some((p) => p.id === payload.new.id)) return prev;
              return [payload.new, ...prev];
            }
            if (payload.eventType === 'UPDATE') {
              return prev.map((p) => (p.id === payload.new.id ? payload.new : p));
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter((p) => p.id !== payload.old.id);
            }
            return prev;
          });
        })
        .subscribe();
    }

    boot();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase]);

  const authorName = useCallback(
    (item) => {
      if (item.is_example) return 'Пример';
      const p = profiles[item.author_id];
      return p?.display_name || p?.email || 'Кто-то';
    },
    [profiles]
  );

  async function saveName() {
    if (!me || !nameDraft.trim()) {
      setEditingName(false);
      return;
    }
    await supabase.from('profiles').update({ display_name: nameDraft.trim() }).eq('id', me.id);
    setProfiles((prev) => ({ ...prev, [me.id]: { ...prev[me.id], display_name: nameDraft.trim() } }));
    setEditingName(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  // --- stats ---
  const stats = useMemo(() => {
    const meetings = items.filter((i) => i.type === 'meeting');
    const problems = items.filter((i) => i.type === 'retro_problem');
    const open = problems.filter((i) => i.status && i.status !== 'resolved');
    const byCat = {};
    problems.forEach((i) => {
      if (i.category) {
        byCat[i.category] = byCat[i.category] || new Set();
        byCat[i.category].add(i.project);
      }
    });
    const recurring = Object.keys(byCat).filter((k) => byCat[k].size >= 3).length;
    return { total: items.length, meetings: meetings.length, open: open.length, recurring };
  }, [items]);

  const projectNames = useMemo(
    () => Array.from(new Set(items.map((i) => i.project).filter(Boolean))).sort(),
    [items]
  );
  const authorIds = useMemo(
    () => Array.from(new Set(items.map((i) => i.author_id).filter(Boolean))),
    [items]
  );

  // --- CRUD ---
  async function addEntry(payload) {
    const { data, error } = await supabase
      .from('entries')
      .insert({ ...payload, author_id: me?.id || null })
      .select()
      .single();
    if (!error && data) {
      setItems((prev) => (prev.some((p) => p.id === data.id) ? prev : [data, ...prev]));
    }
    return { data, error };
  }
  async function updateEntry(id, patch) {
    const { data, error } = await supabase.from('entries').update(patch).eq('id', id).select().single();
    if (!error && data) {
      setItems((prev) => prev.map((p) => (p.id === id ? data : p)));
    }
    return { data, error };
  }
  async function deleteEntry(item) {
    if (!window.confirm('Удалить запись?')) return;
    await supabase.from('entries').delete().eq('id', item.id);
    setItems((prev) => prev.filter((p) => p.id !== item.id));
  }
  async function changeStatus(item, status) {
    const history = [...(item.history || []), { status, date: todayStr(), note: '' }];
    await updateEntry(item.id, { status, history, updated_at: new Date().toISOString() });
  }

  async function submitQuick(e) {
    e.preventDefault();
    if (!quick.project.trim() || !quick.text.trim()) {
      alert('Укажите проект и текст.');
      return;
    }
    const isRetro = quick.type === 'retro_problem';
    const d = todayStr();
    await addEntry({
      type: quick.type,
      project: quick.project.trim(),
      date: d,
      text: quick.text.trim(),
      stage: isRetro ? 'draft' : 'formalized',
      status: isRetro ? 'new' : null,
      history: isRetro ? [{ status: 'new', date: d, note: 'Быстрая запись' }] : [],
    });
    setQuick({ type: 'note', project: '', text: '' });
    setQuickOpen(false);
  }

  const drafts = useMemo(() => {
    if (form.type !== 'retro_problem' || !form.project.trim()) return [];
    return items.filter(
      (i) => i.stage === 'draft' && i.type === 'retro_problem' && i.project === form.project.trim()
    );
  }, [items, form.type, form.project]);

  function pickDraft(d) {
    setForm((f) => ({ ...f, editingId: d.id, project: d.project, date: d.date, text: d.text }));
  }

  async function submitEntry(e) {
    e.preventDefault();
    if (!form.project.trim() || !form.text.trim()) {
      alert('Укажите проект и текст.');
      return;
    }
    const isRetroProblem = form.type === 'retro_problem';
    const isRetroPractice = form.type === 'retro_practice';
    const payload = {
      type: form.type,
      project: form.project.trim(),
      date: form.date || todayStr(),
      text: form.text.trim(),
      stage: 'formalized',
      attendees: form.type === 'meeting' ? form.attendees.trim() || null : null,
      category: isRetroProblem || isRetroPractice ? form.category : null,
      status: isRetroProblem ? form.status : null,
      solution: isRetroProblem ? form.solution.trim() || null : null,
      owner: isRetroProblem ? form.owner.trim() || null : null,
    };

    if (form.editingId) {
      const existing = items.find((i) => i.id === form.editingId);
      const history = [
        ...((existing && existing.history) || []),
        { status: payload.status || 'new', date: payload.date, note: 'Оформлено на ретро' },
      ];
      await updateEntry(form.editingId, { ...payload, history, updated_at: new Date().toISOString() });
    } else {
      await addEntry({
        ...payload,
        history: isRetroProblem ? [{ status: payload.status || 'new', date: payload.date, note: 'Зафиксировано' }] : [],
      });
    }
    setForm({ ...emptyForm, date: todayStr() });
  }

  // --- derived views ---
  const feedItems = useMemo(() => {
    return items
      .filter((i) => (feedFilters.project ? i.project === feedFilters.project : true))
      .filter((i) => (feedFilters.type ? i.type === feedFilters.type : true))
      .filter((i) => (feedFilters.author ? i.author_id === feedFilters.author : true))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [items, feedFilters]);

  const retroProblems = useMemo(() => {
    let list = items.filter((i) => i.type === 'retro_problem');
    if (retroFilters.project) list = list.filter((i) => i.project === retroFilters.project);
    if (retroFilters.status) list = list.filter((i) => i.status === retroFilters.status);
    return list;
  }, [items, retroFilters]);
  const retroPractices = useMemo(() => {
    let list = items.filter((i) => i.type === 'retro_practice');
    if (retroFilters.project) list = list.filter((i) => i.project === retroFilters.project);
    return list;
  }, [items, retroFilters]);

  const meName = me ? profiles[me.id]?.display_name || profiles[me.id]?.email || me.email : '';

  return (
    <div className="shell">
      <header className="top">
        <div>
          <div className="eyebrow">ze.studio · живой инструмент</div>
          <h1>Журнал студии</h1>
          <p className="sub">
            Встречи, заметки и ретро по всем проектам в одном месте. Отдельный сайт студии, вход по
            почте @ze.studio.
          </p>
        </div>
        {me && (
          <div className="me" onClick={() => { setNameDraft(meName); setEditingName(true); }} title="Нажмите, чтобы изменить имя">
            <span className="avatar" style={{ background: colorForId(me.id) }}>
              {initials(meName)}
            </span>
            {editingName ? (
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.key === 'Enter' && saveName()}
                onBlur={saveName}
                style={{ padding: '4px 8px', fontSize: 13 }}
              />
            ) : (
              <span>
                <span className="me-k">вы вошли как</span>
                <span className="me-name">{meName}</span>
              </span>
            )}
          </div>
        )}
      </header>

      <div className="stats">
        <div className="stat"><div className="v mono">{stats.total}</div><div className="k">записей всего</div></div>
        <div className="stat"><div className="v mono">{stats.meetings}</div><div className="k">встреч</div></div>
        <div className="stat"><div className="v mono">{stats.open}</div><div className="k">открытых проблем</div></div>
        <div className="stat"><div className="v mono">{stats.recurring}</div><div className="k">повторяющихся тем</div></div>
      </div>

      <nav className="tabs">
        {[
          ['feed', 'Лента'],
          ['retro', 'Доска ретро'],
          ['new', 'Новая запись'],
        ].map(([id, label]) => (
          <button
            key={id}
            className={`tab-btn ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>

      {loading && <div className="empty">Загрузка…</div>}

      {!loading && tab === 'feed' && (
        <section>
          <button type="button" className="quick-fab" onClick={() => setQuickOpen((v) => !v)}>
            + Быстрая запись
          </button>
          {quickOpen && (
            <form className="quick-form" onSubmit={submitQuick}>
              <h4>Быстрая запись — разобрать позже</h4>
              <p className="hint" style={{ margin: '-4px 0 12px' }}>
                Минимум полей, чтобы не откладывать. Тип и детали можно уточнить потом во вкладке
                «Новая запись».
              </p>
              <div className="row">
                <div>
                  <label>Тип</label>
                  <select value={quick.type} onChange={(e) => setQuick((q) => ({ ...q, type: e.target.value }))}>
                    <option value="note">Заметка</option>
                    <option value="retro_problem">Проблема (для ретро)</option>
                    <option value="risk">Риск</option>
                    <option value="decision">Решение</option>
                    <option value="agreement">Договорённость</option>
                    <option value="client_mood">Настроение клиента</option>
                  </select>
                </div>
                <div>
                  <label>Проект</label>
                  <input
                    list="project-list"
                    value={quick.project}
                    onChange={(e) => setQuick((q) => ({ ...q, project: e.target.value }))}
                    placeholder="Название проекта"
                  />
                </div>
              </div>
              <div className="row">
                <div style={{ flex: '1 1 100%' }}>
                  <label>Текст</label>
                  <textarea
                    value={quick.text}
                    onChange={(e) => setQuick((q) => ({ ...q, text: e.target.value }))}
                    placeholder="Коротко, по сути"
                  />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn">Сохранить</button>
                <button type="button" className="btn ghost" onClick={() => setQuickOpen(false)}>Отмена</button>
              </div>
            </form>
          )}

          <div className="filters" style={{ marginTop: 20 }}>
            <select value={feedFilters.project} onChange={(e) => setFeedFilters((f) => ({ ...f, project: e.target.value }))}>
              <option value="">Все проекты</option>
              {projectNames.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={feedFilters.type} onChange={(e) => setFeedFilters((f) => ({ ...f, type: e.target.value }))}>
              <option value="">Все типы</option>
              {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
            <select value={feedFilters.author} onChange={(e) => setFeedFilters((f) => ({ ...f, author: e.target.value }))}>
              <option value="">Все авторы</option>
              {authorIds.map((id) => (
                <option key={id} value={id}>{profiles[id]?.display_name || profiles[id]?.email || 'Кто-то'}</option>
              ))}
            </select>
          </div>

          {feedItems.length === 0 && <div className="empty">Ничего не найдено по текущим фильтрам.</div>}
          {feedItems.map((it) => (
            <ItemRow key={it.id} item={it} authorName={authorName(it)} isDark={isDark} onDelete={deleteEntry} onStatusChange={changeStatus} />
          ))}
        </section>
      )}

      {!loading && tab === 'retro' && (
        <section>
          <div className="filters">
            <select value={retroFilters.project} onChange={(e) => setRetroFilters((f) => ({ ...f, project: e.target.value }))}>
              <option value="">Все проекты</option>
              {projectNames.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={retroFilters.status} onChange={(e) => setRetroFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">Все статусы</option>
              {Object.keys(STATUS_LABEL).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>

          {CATEGORIES.map(([id, label]) => {
            const catItems = retroProblems
              .filter((i) => i.category === id)
              .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            if (catItems.length === 0) return null;
            const distinctProjects = new Set(catItems.map((i) => i.project)).size;
            const recurring = distinctProjects >= 3;
            const maxCount = Math.max(1, ...CATEGORIES.map(([cid]) => retroProblems.filter((i) => i.category === cid).length));
            const barPct = Math.round((100 * catItems.length) / maxCount);
            const col = catColor(id, isDark);
            return (
              <div className="cat-block" key={id}>
                <div className="cat-head">
                  <span className="cat-chip" style={{ background: col.bg, color: col.fg }}>{label}</span>
                  <h3>{label}</h3>
                  <span className="cat-count mono">{catItems.length} · {distinctProjects} проект(ов)</span>
                  {recurring && <span className="recur-badge">🔁 повторяется</span>}
                </div>
                <div className="cat-bar"><i style={{ width: `${barPct}%`, background: col.fg }} /></div>
                {catItems.map((it) => (
                  <ItemRow key={it.id} item={it} authorName={authorName(it)} isDark={isDark} onDelete={deleteEntry} onStatusChange={changeStatus} />
                ))}
              </div>
            );
          })}

          {retroPractices.length > 0 && (
            <div className="cat-block">
              <div className="cat-head"><h3>Практики, которые сработали</h3><span className="cat-count mono">{retroPractices.length}</span></div>
              {retroPractices
                .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                .map((it) => (
                  <ItemRow key={it.id} item={it} authorName={authorName(it)} isDark={isDark} onDelete={deleteEntry} onStatusChange={changeStatus} />
                ))}
            </div>
          )}

          {retroProblems.length === 0 && retroPractices.length === 0 && (
            <div className="empty">Ничего не найдено.</div>
          )}
        </section>
      )}

      {!loading && tab === 'new' && (
        <section>
          <div className="guide">{TYPE_GUIDE[form.type]}</div>
          <div className="type-picker">
            {TYPE_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                className={form.type === t ? 'active' : ''}
                onClick={() => setForm((f) => ({ ...f, type: t }))}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>

          {form.type === 'retro_problem' && (
            <div className="drafts-panel">
              <h4>Черновики проблем по проекту</h4>
              <div style={{ maxWidth: 320, marginBottom: 14 }}>
                <input
                  list="project-list"
                  value={form.project}
                  onChange={(e) => setForm((f) => ({ ...f, project: e.target.value }))}
                  placeholder="Введите название проекта"
                />
              </div>
              {!form.project && <div className="empty">Введите проект выше, чтобы увидеть черновики.</div>}
              {form.project && drafts.length === 0 && (
                <div className="empty">Черновиков по «{form.project}» нет — можно сразу заполнить форму.</div>
              )}
              {drafts.map((d) => (
                <div className="draft-card" key={d.id} onClick={() => pickDraft(d)}>
                  <div className="d-date mono">{d.date}</div>
                  {d.text}
                </div>
              ))}
            </div>
          )}

          <form className="entry-form" onSubmit={submitEntry}>
            <div className="row">
              <div>
                <label>Проект</label>
                <input list="project-list" value={form.project} onChange={(e) => setForm((f) => ({ ...f, project: e.target.value }))} />
              </div>
              <div>
                <label>Дата</label>
                <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
            </div>

            {form.type === 'meeting' && (
              <div className="row">
                <div style={{ flex: '1 1 100%' }}>
                  <label>Участники встречи</label>
                  <input value={form.attendees} onChange={(e) => setForm((f) => ({ ...f, attendees: e.target.value }))} placeholder="Имена через запятую" />
                </div>
              </div>
            )}

            {(form.type === 'retro_problem' || form.type === 'retro_practice') && (
              <div className="row">
                <div>
                  <label>Категория</label>
                  <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </div>
                {form.type === 'retro_problem' && (
                  <div>
                    <label>Статус</label>
                    <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                      {Object.keys(STATUS_LABEL).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="row">
              <div style={{ flex: '1 1 100%' }}>
                <label>{form.type === 'meeting' ? 'Повестка / итоги' : 'Текст'}</label>
                <textarea value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} placeholder="Текст записи" />
              </div>
            </div>

            {form.type === 'retro_problem' && (
              <>
                <div className="row">
                  <div style={{ flex: '1 1 100%' }}>
                    <label>Предлагаемое решение</label>
                    <textarea value={form.solution} onChange={(e) => setForm((f) => ({ ...f, solution: e.target.value }))} placeholder="Что конкретно изменить" />
                  </div>
                </div>
                <div className="row">
                  <div>
                    <label>Ответственный за решение</label>
                    <input value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} placeholder="Имя" />
                  </div>
                </div>
              </>
            )}

            <div className="form-actions">
              <button type="submit" className="btn">Сохранить</button>
              <button type="button" className="btn ghost" onClick={() => setForm({ ...emptyForm, date: todayStr() })}>Очистить форму</button>
            </div>
          </form>
        </section>
      )}

      <datalist id="project-list">
        {projectNames.map((p) => <option key={p} value={p} />)}
      </datalist>

      <footer className="bottom">
        <div>Журнал студии · ze.studio</div>
        {me && (
          <button type="button" className="btn ghost" style={{ marginTop: 10 }} onClick={signOut}>
            Выйти ({me.email})
          </button>
        )}
      </footer>
    </div>
  );
}
