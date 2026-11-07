import { useState } from 'react';
import { imgSrc } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { drawListCard, listText, cardFileName } from '../lib/listCard.js';

const loadImage = (url) =>
  new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous'; // needed to save the card when the API is on another address
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = imgSrc(url);
  });

const canShareFiles = () => {
  try {
    return typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
};

// Download or share a list as a poster image, or as plain text
export default function ListCardDownload({ list }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!list.items.length) return null;

  async function makeBlob() {
    const canvas = document.createElement('canvas');
    await drawListCard(canvas, { title: list.title, owner: list.owner.username, ranked: list.ranked, items: list.items }, loadImage);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) throw new Error('Could not build the image');
    return blob;
  }

  async function download() {
    setBusy(true);
    try {
      const blob = await makeBlob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = cardFileName(list.title, 'png');
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      toast(e.message || 'Download failed', 'error');
    }
    setBusy(false);
  }

  async function share() {
    setBusy(true);
    try {
      const file = new File([await makeBlob()], cardFileName(list.title, 'png'), { type: 'image/png' });
      await navigator.share({ files: [file], title: list.title });
    } catch (e) {
      if (e?.name !== 'AbortError') toast(e.message || 'Could not share', 'error'); // closing the share sheet is not an error
    }
    setBusy(false);
  }

  function text() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([listText(list)], { type: 'text/plain' }));
    a.download = cardFileName(list.title, 'txt');
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  return (
    <div className="cl-actions cl-card-actions">
      <button type="button" className="btn btn-line btn-sm" onClick={download} disabled={busy}>{busy ? 'Drawing…' : 'Download card'}</button>
      {canShareFiles() && <button type="button" className="btn btn-line btn-sm" onClick={share} disabled={busy}>Share card</button>}
      <button type="button" className="btn btn-quiet btn-sm" onClick={text}>Text list</button>
    </div>
  );
}
