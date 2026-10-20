// Friendly failure message with a retry button
export default function ErrorState({ message, onRetry, title = 'Something went wrong' }) {
  return (
    <div className="empty-state error-state" role="alert">
      <h3 className="es-title">{title}</h3>
      <p>{message || 'The catalogue did not answer. It is usually brief.'}</p>
      {onRetry && <button type="button" className="btn btn-line" onClick={onRetry}>Try again</button>}
    </div>
  );
}
