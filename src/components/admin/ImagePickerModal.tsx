import { useRef, useState } from 'react';
import { Check, ImagePlus, Link2, Upload, X } from 'lucide-react';
import { OSTERIA_PHOTO_CATALOG } from '../../data/seedData';
import { uploadMediaAsset } from '../../lib/osteriaService';
import type { MediaAsset } from '../../types/osteria';
import { MediaImage } from '../MediaImage';

const BUILTIN_PHOTOS = OSTERIA_PHOTO_CATALOG;

interface ImagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl: string;
  mediaAssets: MediaAsset[];
  userId?: string | null;
  onSelect: (imageUrl: string, mediaId?: string | null) => void;
  onAssetUploaded?: (asset: MediaAsset) => void;
}

export function ImagePickerModal({
  isOpen,
  onClose,
  currentUrl,
  mediaAssets,
  userId,
  onSelect,
  onAssetUploaded,
}: ImagePickerModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState(currentUrl.startsWith('media:') ? '' : currentUrl);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleFileUpload = async (file: File) => {
    setErrorMsg('');
    setUploading(true);
    try {
      const asset = await uploadMediaAsset(file, userId);
      onAssetUploaded?.(asset);
      onSelect(`media:${asset.id}`, asset.id);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao enviar imagem.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Selecionar fotografia"
    >
      <div className="w-full max-w-3xl max-h-[88vh] bg-[#FAF6F0] rounded-2xl border border-[#2A1E17]/15 shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 bg-white border-b border-[#2A1E17]/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImagePlus className="w-5 h-5 text-[#A64B2A]" />
            <h3 className="font-display text-2xl font-semibold text-[#2A1E17]">
              Escolher ou Enviar Fotografia
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-[#F3ECE2] flex items-center justify-center cursor-pointer"
            aria-label="Fechar seletor de imagem"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Upload + Direct URL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-[#2A1E17]/10 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#2A1E17]">
                Enviar do celular ou computador
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 px-4 rounded-lg bg-[#A64B2A] text-white text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-95 cursor-pointer disabled:opacity-60"
              >
                <Upload className="w-4 h-4" />
                <span>{uploading ? 'Enviando e salvando...' : 'Selecionar imagem do dispositivo'}</span>
              </button>
              <p className="text-[11px] text-[#6C5B4F]">
                Otimizada automaticamente e salva permanentemente no banco de dados.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-[#2A1E17]/10 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#2A1E17]">
                Ou usar link externo (URL)
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6C5B4F]" />
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#2A1E17]/15 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (urlInput.trim()) {
                      onSelect(urlInput.trim(), null);
                      onClose();
                    }
                  }}
                  className="px-3.5 py-2 rounded-lg bg-[#2A1E17] text-white text-xs font-semibold cursor-pointer"
                >
                  Usar
                </button>
              </div>
              {currentUrl && (
                <button
                  type="button"
                  onClick={() => {
                    onSelect('', null);
                    onClose();
                  }}
                  className="text-xs text-red-700 hover:underline cursor-pointer"
                >
                  Remover fotografia atual
                </button>
              )}
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {errorMsg}
            </p>
          )}

          {/* Uploaded Media Library */}
          {mediaAssets.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6C5B4F] mb-3">
                Biblioteca Enviada ({mediaAssets.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {mediaAssets.map((asset) => {
                  const mediaRef = `media:${asset.id}`;
                  const selected = currentUrl === mediaRef;
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => {
                        onSelect(mediaRef, asset.id);
                        onClose();
                      }}
                      className={`group relative rounded-xl overflow-hidden border text-left bg-white cursor-pointer ${
                        selected ? 'ring-2 ring-[#A64B2A] border-[#A64B2A]' : 'border-[#2A1E17]/10'
                      }`}
                    >
                      <div className="aspect-[4/3] w-full overflow-hidden">
                        <img
                          src={asset.dataUrl}
                          alt={asset.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <p className="p-2 text-[11px] font-medium text-[#2A1E17] truncate">
                        {asset.name}
                      </p>
                      {selected && (
                        <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#A64B2A] text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Built-in Curated Osteria Photos */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6C5B4F] mb-3">
              Fotografias da Osteria
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {BUILTIN_PHOTOS.map((photo) => {
                const selected = currentUrl === photo.url;
                return (
                  <button
                    key={photo.url}
                    type="button"
                    onClick={() => {
                      onSelect(photo.url, null);
                      onClose();
                    }}
                    className={`group relative rounded-xl overflow-hidden border text-left bg-white cursor-pointer ${
                      selected ? 'ring-2 ring-[#A64B2A] border-[#A64B2A]' : 'border-[#2A1E17]/10'
                    }`}
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden">
                      <MediaImage
                        src={photo.url}
                        alt={photo.label}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <p className="p-2 text-[11px] font-medium text-[#2A1E17] truncate">
                      {photo.label}
                    </p>
                    {selected && (
                      <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#A64B2A] text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
