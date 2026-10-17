import { useId } from 'react';

// A slanted, sliced "A": the diagonal cut is a mask, so the mark takes whatever colour the parent sets.
export default function Logo({ size = 30 }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="logo-mark" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <defs>
        <mask id={id}>
          <rect width="64" height="64" fill="#fff" />
          <polygon points="4,44 8,44 60,22 56,22" fill="#000" />
        </mask>
      </defs>
      <g transform="skewX(-12) translate(10,0)" mask={`url(#${id})`}>
        <path fill="currentColor" fillRule="evenodd" d="M32 6 L56 58 H41.5 L38.6 50.5 H25.4 L22.5 58 H8 Z M32 24 L27.8 40 H36.2 Z" />
      </g>
    </svg>
  );
}
