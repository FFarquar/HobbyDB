import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { getImages, uploadImage, deleteImage } from '../api/client.js';
import { useToast } from './Toast.jsx';

const ImageGallery = forwardRef(function ImageGallery({ entityId, entityLabel }, ref) {
  const [images,  setImages]  = useState([]);
  const [pending, setPending] = useState([]); // { file, previewUrl }
  const [loading, setLoading] = useState(true);
  const toast   = useToast();
  const fileRef = useRef(null);

  useEffect(() => {
    getImages(entityId)
      .then(setImages)
      .catch(err => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [entityId]);

  // Called by the parent modal on Save — uploads all staged files then refreshes.
  useImperativeHandle(ref, () => ({
    async flush() {
      if (pending.length === 0) return;
      for (const { file } of pending) {
        await uploadImage(file, entityId, entityLabel); // throws on failure
      }
      pending.forEach(p => URL.revokeObjectURL(p.previewUrl));
      setPending([]);
      const updated = await getImages(entityId);
      setImages(updated);
    },
  }));

  function handleFiles(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const newPending = files.map(file => ({ file, previewUrl: URL.createObjectURL(file) }));
    setPending(prev => [...prev, ...newPending]);
    e.target.value = '';
  }

  function removePending(index) {
    setPending(prev => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleDelete(key) {
    try {
      await deleteImage(key, entityId);
      setImages(imgs => imgs.filter(i => i.key !== key));
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const hasAny = images.length > 0 || pending.length > 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label style={{ fontWeight: 500, margin: 0 }}>Photos</label>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => fileRef.current?.click()}
        >
          + Add Photo
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFiles}
        />
      </div>

      {loading ? (
        <div className="spinner" style={{ margin: '8px auto' }} />
      ) : !hasAny ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>No photos yet.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {images.map(img => (
            <div key={img.key} style={{ position: 'relative', width: 88, height: 88, flexShrink: 0 }}>
              <img
                src={img.url}
                alt={img.filename}
                style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 6, display: 'block' }}
              />
              <button
                type="button"
                onClick={() => handleDelete(img.key)}
                style={deleteBtnStyle}
                title="Remove photo"
              >✕</button>
            </div>
          ))}

          {pending.map((p, i) => (
            <div key={i} style={{ position: 'relative', width: 88, height: 88, flexShrink: 0 }}>
              <img
                src={p.previewUrl}
                alt={p.file.name}
                style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 6, display: 'block', opacity: 0.55 }}
              />
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 6,
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                paddingBottom: 5,
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.55)', padding: '1px 4px', borderRadius: 3 }}>
                  unsaved
                </span>
              </div>
              <button
                type="button"
                onClick={() => removePending(i)}
                style={deleteBtnStyle}
                title="Remove"
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

const deleteBtnStyle = {
  position: 'absolute', top: 3, right: 3,
  background: 'rgba(0,0,0,0.65)', color: '#fff',
  border: 'none', borderRadius: '50%',
  width: 20, height: 20, padding: 0,
  cursor: 'pointer', fontSize: 10,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

export default ImageGallery;
