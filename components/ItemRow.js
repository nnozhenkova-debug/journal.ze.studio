'use client';

import { CATEGORY_LABEL, STATUS_LABEL, TYPE_LABEL, catColor } from '../lib/journal-constants';

export default function ItemRow({ item, authorName, isDark, onDelete, onStatusChange }) {
  const showCat = item.type === 'retro_problem' || item.type === 'retro_practice';
  const col = showCat && item.category ? catColor(item.category, isDark) : null;

  return (
    <details className="item">
      <summary>
        <span className={`type-badge type-${item.type}`}>{TYPE_LABEL[item.type]}</span>
        {col && (
          <span className="cat-chip" style={{ background: col.bg, color: col.fg }}>
            {CATEGORY_LABEL[item.category] || item.category}
          </span>
        )}
        <span className="proj">{item.project || '—'}</span>
        <span className="date mono">{item.date}</span>
        <span className="author">· {authorName}</span>
        <span className="snippet">{item.text}</span>
        {item.is_example && <span className="badge example">пример</span>}
        {item.type === 'retro_problem' && (
          <span className={`badge ${item.status}`}>{STATUS_LABEL[item.status]}</span>
        )}
      </summary>
      <div className="item-body">
        <div className="field">
          <div className="k">Текст</div>
          <div className="v">{item.text}</div>
        </div>
        {item.type === 'meeting' && item.attendees && (
          <div className="field">
            <div className="k">Участники</div>
            <div className="v">{item.attendees}</div>
          </div>
        )}
        {item.solution && (
          <div className="field">
            <div className="k">Предлагаемое решение</div>
            <div className="v">{item.solution}</div>
          </div>
        )}
        {item.owner && (
          <div className="field">
            <div className="k">Ответственный</div>
            <div className="v">{item.owner}</div>
          </div>
        )}
        {item.type === 'retro_problem' && (
          <div className="field">
            <div className="k">История</div>
            <div className="timeline">
              {(item.history && item.history.length ? [...item.history].reverse() : []).map((h, i) => (
                <div className="tl-row" key={i}>
                  <span className="dot" />
                  <span>
                    {h.date} — {STATUS_LABEL[h.status] || h.status}
                    {h.note ? `: ${h.note}` : ''}
                  </span>
                </div>
              ))}
              {(!item.history || item.history.length === 0) && (
                <div className="tl-row">
                  <span className="dot" />
                  <span>история не велась</span>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="item-controls">
          {item.type === 'retro_problem' && (
            <select value={item.status || 'new'} onChange={(e) => onStatusChange(item, e.target.value)}>
              {Object.keys(STATUS_LABEL).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          )}
          <button type="button" className="del-btn" onClick={() => onDelete(item)}>
            Удалить
          </button>
        </div>
      </div>
    </details>
  );
}
