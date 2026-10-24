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

// Turns any picture into a wide JPEG data URL that is safe to use as a profile banner.
// A picture taller than 2:1 is cropped (around its centre) to 2:1; the rest of the cropping to fit each screen happens when it
// is shown, and the person chooses which part to keep with the position sliders. It is shrunk until it is small enough to store.
export async function fileToBanner(file, maxChars = 330000) {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') throw new Error('Choose a JPEG, PNG or WebP picture');
  if (file.size > 15 * 1024 * 1024) throw new Error('That picture is over 15 MB');

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read that picture'));
      el.src = url;
    });
    if (img.naturalWidth < 600) throw new Error('That picture is too small for a banner. Pick one at least 600 pixels wide.');

    let sw = img.naturalWidth;
    let sh = img.naturalHeight;
    let sy = 0;
    if (sw / sh < 2) {
      sh = Math.round(sw / 2);
      sy = Math.round((img.naturalHeight - sh) / 2);
    }
    for (const width of [1600, 1280, 1000]) {
      const w = Math.min(width, sw);
      const h = Math.round((w * sh) / sw);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1c1c1c'; // JPEG has no transparency
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, sy, sw, sh, 0, 0, w, h);
      for (const quality of [0.82, 0.72, 0.62, 0.5]) {
        const data = canvas.toDataURL('image/jpeg', quality);
        if (data.length <= maxChars) return data;
      }
    }
    throw new Error('That picture is too detailed to shrink. Try another one.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
