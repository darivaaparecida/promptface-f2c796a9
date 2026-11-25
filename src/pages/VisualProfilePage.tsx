import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Trash2, CheckCircle2, ShieldAlert, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { VisualProfileData } from '../shared/rules';
import { ImageWithFallback } from '../components/ImageWithFallback';

interface FaceItem {
  id: string;
  filename: string;
  mimeType: string;
  faceVerified: boolean;
  createdAt: string;
  url: string;
}

const EMPTY_PROFILE: VisualProfileData = {
  eyeColor: '',
  hairColorStyle: '',
  hairType: '',
  beardMustache: '',
  skinTone: '',
  facialFeatures: '',
  heightBodyType: '',
  otherCharacteristics: '',
};

async function fileToResizedDataUrl(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagem inválido'));
      img.onload = () => {
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Erro ao processar imagem'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const outMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(outMime, 0.9);
        resolve({ base64: dataUrl, mimeType: outMime });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function VisualProfilePage() {
  const { apiFetch, getMediaUrl } = useAuth();
  const [faces, setFaces] = useState<FaceItem[]>([]);
  const [profile, setProfile] = useState<VisualProfileData>(EMPTY_PROFILE);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadData = async () => {
    try {
      const res = await apiFetch('/api/profile');
      if (res.ok) {
        const data = (await res.json()) as {
          profile: VisualProfileData | null;
          faces: FaceItem[];
        };
        if (data.profile) setProfile({ ...EMPTY_PROFILE, ...data.profile });
        setFaces(data.faces || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUploadFace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setFeedback(null);
    if (!consentAccepted) {
      setFeedback({
        type: 'err',
        text: 'Marque a caixa de consentimento explícito antes de enviar sua foto.',
      });
      return;
    }

    setUploading(true);
    try {
      const { base64, mimeType } = await fileToResizedDataUrl(file);
      const res = await apiFetch('/api/faces', {
        method: 'POST',
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          consentAccepted: true,
        }),
      });
      const data = (await res.json()) as { face?: FaceItem; error?: string };
      if (!res.ok || !data.face) {
        setFeedback({ type: 'err', text: data.error || 'Não foi possível enviar esta foto.' });
        return;
      }
      setFaces((prev) => [data.face!, ...prev]);
      setFeedback({
        type: 'ok',
        text: 'Foto de referência salva com segurança e privada na sua conta.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Erro ao processar a foto.',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFace = async (id: string) => {
    setFeedback(null);
    const res = await apiFetch(`/api/faces/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setFaces((prev) => prev.filter((f) => f.id !== id));
      setFeedback({ type: 'ok', text: 'Foto removida permanentemente dos nossos servidores.' });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setFeedback(null);
    try {
      const res = await apiFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        setFeedback({ type: 'ok', text: 'Perfil Visual atualizado com sucesso.' });
      } else {
        setFeedback({ type: 'err', text: 'Não foi possível salvar o Perfil Visual.' });
      }
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-14 space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[#8B5CF6]">
            Privado por padrão · LGPD
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-white">
            Meu Perfil Visual
          </h1>
          <p className="mt-2 text-sm sm:text-base text-[#A1A1AA] max-w-2xl">
            Envie uma ou mais fotos do seu próprio rosto e descreva detalhes visuais opcionais para aumentar a fidelidade em cada geração.
          </p>
        </div>
        {faces.length > 0 && (
          <Link
            to="/criar"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white whitespace-nowrap shrink-0"
          >
            Ir para Criar Foto
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        )}
      </div>

      {feedback && (
        <div
          role="status"
          className={`rounded-xl px-4 py-3 text-sm border flex items-center gap-2.5 ${
            feedback.type === 'ok'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/40 border-red-500/40 text-red-200'
          }`}
        >
          {feedback.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          ) : (
            <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Photo Upload + Guidelines */}
      <section className="rounded-2xl border border-white/10 bg-[#17171F] p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-4">
            <h2 className="font-display text-lg font-semibold text-white">
              Orientações para melhor preservação facial
            </h2>
            <ul className="space-y-2 text-sm text-[#A1A1AA]">
              <li>· Boa iluminação natural ou frontal sem sombras duras</li>
              <li>· Rosto bem visível e centralizado</li>
              <li>· Preferencialmente sem filtros de redes sociais</li>
              <li>· Evitar óculos escuros, bonés ou objetos cobrindo o rosto</li>
              <li>· Evitar fotos desfocadas ou em baixa resolução</li>
              <li>· Se possível, envie fotos frontais e em diferentes ângulos</li>
            </ul>
          </div>

          <div className="lg:col-span-7 space-y-5">
            <label className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-[#08080C] cursor-pointer">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 rounded accent-[#7C3AED]"
              />
              <span className="text-xs sm:text-sm text-[#A1A1AA] leading-relaxed">
                Confirmo que esta foto é exclusivamente do meu próprio rosto (ou possuo autorização expressa), concordo com o processamento para geração de imagens conforme a{' '}
                <Link to="/lgpd" className="text-[#8B5CF6] underline">
                  LGPD
                </Link>{' '}
                e sei que minhas referências nunca são públicas nem usadas para treinar modelos.
              </span>
            </label>

            <label
              className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
                consentAccepted
                  ? 'border-[#7C3AED]/70 hover:border-[#8B5CF6] bg-[#08080C]/60 cursor-pointer'
                  : 'border-white/10 bg-[#08080C]/30 opacity-75 cursor-not-allowed'
              }`}
            >
              <Upload className="w-6 h-6 text-[#8B5CF6]" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-white">
                  {uploading ? 'Validando e salvando foto...' : 'Selecionar foto do meu rosto'}
                </p>
                <p className="mt-1 text-xs text-[#A1A1AA]">JPG, PNG ou WebP até 6 MB</p>
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading || !consentAccepted}
                onChange={handleUploadFace}
                className="sr-only"
              />
            </label>
          </div>
        </div>

        {/* Uploaded references grid */}
        <div className="pt-4 border-t border-white/10">
          <h3 className="font-display text-sm font-semibold text-white mb-4">
            Minhas referências faciais ({faces.length})
          </h3>
          {loading ? (
            <div className="h-32 rounded-xl skeleton-violet" />
          ) : faces.length === 0 ? (
            <p className="text-sm text-[#A1A1AA]">
              Você ainda não enviou nenhuma foto de referência. Aceite o termo acima e envie sua primeira foto.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {faces.map((face) => (
                <div
                  key={face.id}
                  className="relative aspect-[3/4] rounded-xl overflow-hidden border border-white/10 bg-[#08080C]"
                >
                  <ImageWithFallback
                    src={getMediaUrl(face.url)}
                    alt="Referência facial privada"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteFace(face.id)}
                    aria-label="Excluir foto de referência"
                    className="absolute top-2 right-2 p-2 rounded-lg bg-[#08080C]/85 text-white hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <span className="absolute bottom-2 left-2 text-[11px] text-white/90 bg-[#08080C]/80 px-2 py-0.5 rounded">
                    Privada
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Optional Visual Profile Attributes */}
      <section className="rounded-2xl border border-white/10 bg-[#17171F] p-6 sm:p-8">
        <h2 className="font-display text-lg font-semibold text-white">
          Características visuais opcionais
        </h2>
        <p className="mt-1 text-sm text-[#A1A1AA]">
          Esses campos complementam suas fotos de referência para manter consistência entre cenários.
        </p>

        <form onSubmit={handleSaveProfile} className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: 'eyeColor', label: 'Cor dos olhos', placeholder: 'Ex.: Castanhos escuros' },
            {
              key: 'hairColorStyle',
              label: 'Cor e estilo do cabelo',
              placeholder: 'Ex.: Castanho escuro curto ondulado',
            },
            { key: 'hairType', label: 'Tipo de cabelo', placeholder: 'Ex.: Liso, ondulado, cacheado, crespo' },
            { key: 'beardMustache', label: 'Barba e bigode', placeholder: 'Ex.: Barba curta aparada / sem barba' },
            { key: 'skinTone', label: 'Tom de pele', placeholder: 'Ex.: Oliva claro, pardo, retinto' },
            {
              key: 'facialFeatures',
              label: 'Características faciais',
              placeholder: 'Ex.: Sardas sutis, óculos finos, covinhas',
            },
            {
              key: 'heightBodyType',
              label: 'Altura e tipo físico',
              placeholder: 'Ex.: 1,78m, porte atlético / médio',
            },
            {
              key: 'otherCharacteristics',
              label: 'Outras características visuais',
              placeholder: 'Ex.: Tatuagem discreta no antebraço',
            },
          ].map((field) => (
            <div key={field.key} className="space-y-1.5">
              <label
                htmlFor={`vp-${field.key}`}
                className="block text-xs font-medium text-[#A1A1AA]"
              >
                {field.label}
              </label>
              <input
                id={`vp-${field.key}`}
                type="text"
                value={profile[field.key as keyof VisualProfileData] || ''}
                onChange={(e) =>
                  setProfile((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                placeholder={field.placeholder}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080C] border border-white/15 text-sm text-white placeholder:text-[#A1A1AA]/50 focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>
          ))}

          <div className="sm:col-span-2 pt-2 flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white hover:brightness-110 disabled:opacity-60"
            >
              {savingProfile ? 'Salvando...' : 'Salvar Perfil Visual'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
