export default function ErrorCard({ title = 'Не удалось сохранить', hint = 'Проверьте соединение и повторите', onRetry, retrying }) {
  return (
    <div className="error-card">
      <div className="error-card-body">
        <div className="error-card-title">{title}</div>
        <div className="error-card-sub">{hint}</div>
      </div>
      {onRetry && (
        <button type="button" className="error-card-retry" onClick={onRetry} disabled={retrying}>
          {retrying ? 'Повторяем…' : 'Повторить'}
        </button>
      )}
    </div>
  );
}
