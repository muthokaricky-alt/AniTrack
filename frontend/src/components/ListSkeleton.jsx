export default function ListSkeleton({ rows = 6 }) {
  return (
    <div className="list-skel" aria-busy="true" aria-label="Loading your list">
      <div className="skeleton-line" style={{ height: 90, marginBottom: 32 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <div className="ls-row" key={i}>
          <div className="skeleton-img" style={{ width: 64, height: 92, aspectRatio: 'auto' }} />
          <div className="ls-text">
            <div className="skeleton-line" />
            <div className="skeleton-line short" />
          </div>
        </div>
      ))}
    </div>
  );
}
