import { AVATAR_SHAPES } from '../lib/avatarShape.js';

// Choose the shape of your profile picture
export default function ShapePicker({ value, onChange }) {
  return (
    <div className="shape-picker" role="radiogroup" aria-label="Photo shape">
      {AVATAR_SHAPES.map((s) => (
        <button
          key={s.key}
          type="button"
          role="radio"
          aria-checked={value === s.key}
          className={`shape-opt ${value === s.key ? 'on' : ''}`}
          onClick={() => onChange(s.key)}
        >
          <span className="shape-swatch" data-shape={s.key} aria-hidden="true" />
          <span>{s.label}</span>
        </button>
      ))}
    </div>
  );
}
