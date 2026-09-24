'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function TemplatePicker({ templates }) {
  const [selectedId, setSelectedId] = useState(templates[0]?.id);

  return (
    <div>
      <div className="template-list">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`template-row${t.id === selectedId ? ' is-selected' : ''}`}
            onClick={() => setSelectedId(t.id)}
          >
            <div className="t-name">{t.name}</div>
            <div className="t-tagline">{t.tagline}</div>
          </button>
        ))}
      </div>
      <Link href={`/retro/prepare?template=${selectedId}`} className="btn btn-primary template-cta">
        Начать подготовку →
      </Link>
    </div>
  );
}
