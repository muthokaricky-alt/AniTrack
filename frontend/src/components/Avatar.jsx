import { shapeOf } from '../lib/avatarShape.js';

// A user's photo, or their initial on an accent square when they haven't set one. It takes the shape the person chose
// (`user.avatar_shape`), or `shape` when a preview needs to override it.
export default function Avatar({ user, size = 32, className = '', shape }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.45) };
  const form = shapeOf(shape ?? user?.avatar_shape);
  if (user?.avatar) return <img className={`avatar ${className}`} data-shape={form} style={style} src={user.avatar} alt="" />;
  return (
    <span className={`avatar avatar-initial ${className}`} data-shape={form} style={style} aria-hidden="true">
      {(user?.username || '?').slice(0, 1).toUpperCase()}
    </span>
  );
}
