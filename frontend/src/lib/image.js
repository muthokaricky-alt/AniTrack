// Turns any picture the user picks into a small square JPEG data URL (about 20-40 KB) that is safe to store.
export async function fileToAvatar(file, size = 256) {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') throw new Error('Choose a JPEG, PNG or WebP image');
  if (file.size > 10 * 1024 * 1024) throw new Error('That image is over 10 MB');

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read that image'));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1c1c1c'; // JPEG has no transparency
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);

    for (const quality of [0.86, 0.75, 0.6, 0.45]) {
      const data = canvas.toDataURL('image/jpeg', quality);
      if (data.length < 90000) return data;
    }
    throw new Error('That image is too detailed to shrink. Try another one.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
