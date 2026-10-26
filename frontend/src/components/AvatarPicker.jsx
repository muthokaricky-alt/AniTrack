import { useRef, useState } from 'react';
import { fileToAvatar } from '../lib/image.js';
import Avatar from './Avatar.jsx';

export default function AvatarPicker({ value, username, onChange, size = 88, shape }) {
  const input = useRef(null);
  const [error, setError] = useState('');

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      onChange(await fileToAvatar(file));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="avatar-picker">
      <Avatar user={{ avatar: value, username }} shape={shape} size={size} />
      <div className="avatar-picker-side">
        <div className="avatar-picker-btns">
          <button type="button" className="btn btn-line btn-sm" onClick={() => input.current?.click()}>
            {value ? 'Change photo' : 'Upload photo'}
          </button>
          {value && <button type="button" className="btn btn-quiet btn-sm" onClick={() => onChange(null)}>Remove</button>}
        </div>
        <small>JPEG, PNG or WebP. It is cropped to a square.</small>
        {error && <p className="error-text">{error}</p>}
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} hidden />
      </div>
    </div>
  );
}
