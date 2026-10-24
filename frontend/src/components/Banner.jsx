// The wide picture across the top of a profile. `x` and `y` (0 to 100) say which part of the picture stays in view when the
// frame is cropped, which happens differently on a phone, a laptop and a wide monitor.
export default function Banner({ src, x = 50, y = 50, className = '' }) {
  if (!src) return null;
  return (
    <div className={`banner ${className}`}>
      <img src={src} alt="" style={{ objectPosition: `${x}% ${y}%` }} />
      <span className="banner-fade" aria-hidden="true" />
    </div>
  );
}
