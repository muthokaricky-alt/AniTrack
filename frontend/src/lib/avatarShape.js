// The shapes a profile picture can take. 'circle' is what everyone starts with.
export const AVATAR_SHAPES = [
  { key: 'circle', label: 'Circle' },
  { key: 'square', label: 'Square' },
  { key: 'rounded', label: 'Rounded' },
  { key: 'hexagon', label: 'Hexagon' },
  { key: 'heart', label: 'Heart' }
];
export const DEFAULT_SHAPE = 'circle';

// A valid shape, whatever was passed in (old data, missing data)
export const shapeOf = (value) => (AVATAR_SHAPES.some((s) => s.key === value) ? value : DEFAULT_SHAPE);

// A heart drawn in a 1 x 1 box. The page uses it as a clip-path (see App.jsx), and the share card draws with it too.
export const HEART_PATH =
  'M0.5 0.92 C0.08 0.62 0 0.42 0 0.28 C0 0.12 0.12 0.03 0.26 0.03 C0.37 0.03 0.46 0.09 0.5 0.18 C0.54 0.09 0.63 0.03 0.74 0.03 C0.88 0.03 1 0.12 1 0.28 C1 0.42 0.92 0.62 0.5 0.92 Z';

// A hexagon in a 1 x 1 box (the same points the CSS polygon uses)
export const HEX_POINTS = [[0.25, 0.05], [0.75, 0.05], [1, 0.5], [0.75, 0.95], [0.25, 0.95], [0, 0.5]];
