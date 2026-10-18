// A user's photo, or their initial on an orange square when they haven't set one
export default function Avatar({ user, size = 32, className = '' }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.45) };
  if (user?.avatar) return <img className={`avatar ${className}`} style={style} src={user.avatar} alt="" />;
  return (
    <span className={`avatar avatar-initial ${className}`} style={style} aria-hidden="true">
      {(user?.username || '?').slice(0, 1).toUpperCase()}
    </span>
  );
}
