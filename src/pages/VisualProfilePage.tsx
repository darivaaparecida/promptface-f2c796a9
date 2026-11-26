import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Trash2, CheckCircle2, ShieldAlert, ArrowRight, Cpu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  deleteFace,
  getVisualProfile,
  listFaces,
  saveVisualProfile,
  uploadFace,
  type FaceItem,
} from '../lib/db';
import type { VisualProfileData } from '../shared/rules';
import {
  DEFAULT_PREFERRED_AI_MODEL,
  PREFERRED_AI_MODELS,
  getAllowedPreferredModels,
  getPreferredAiModelOption,
  normalizePreferredAiModel,
} from '../shared/aiModels';
import {
  DEFAULT_ABSTRACT_AVATARS,
  resolveProfileAvatarDisplay,
} from '../shared/defaultAvatars';
import { ButtonSpinner } from '../components/ButtonSpinner';
import { ExpandableTextField } from '../components/ExpandableTextField';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { ProfileAvatar } from '../components/ProfileAvatar';

const EMPTY_PROFILE: VisualProfileData = {
  eyeColor: '',
  hairColorStyle: '',
  hairType: '',
  beardMustache: '',
  skinTone: '',
  facialFeatures: '',
  heightBodyType: '',
  otherCharacteristics: '',
  preferredModel: DEFAULT_PREFERRED_AI_MODEL,
};

// Os 8 campos de texto do formulário; a completude soma eles + 1 foto (9 itens).
const PROFILE_TEXT_FIELDS: (keyof VisualProfileData)[] = [
  'eyeColor',
  'hairColorStyle',
  'hairType',
  'beardMustache',
  'skinTone',
  'facialFeatures',
  'heightBodyType',
  'otherCharacteristics',
];

export function VisualProfilePage() {
  const { user, getMediaUrl, refreshUser } = useAuth();
  const { addToast } = useToast();
  const [faces, setFaces] = useState<FaceItem[]>([]);
  const [profile, setProfile] = useState<VisualProfileData>(() => ({
    ...EMPTY_PROFILE,
    preferredModel: normalizePreferredAiModel(user?.preferredModel),
  }));
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingFaceId, setDeletingFaceId] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const allowedModelIds = getAllowedPreferredModels(user?.planId ?? 'free_trial');
  const effectivePreferredModel = allowedModelIds.includes(
    normalizePreferredAiModel(profile.preferredModel)
  )
    ? normalizePreferredAiModel(profile.preferredModel)
    : 'auto';
  const selectedModelOption = getPreferredAiModelOption(effectivePreferredModel);
  const filledTextFields = PROFILE_TEXT_FIELDS.filter(
    (key) => String(profile[key] ?? '').trim() !== ''
  ).length;
  const hasReferencePhoto = faces.length > 0;
  const completedItems = filledTextFields + (hasReferencePhoto ? 1 : 0);
  const completionPercent = Math.round((completedItems / 9) * 100);
  const avatarDisplay = resolveProfileAvatarDisplay({
    faces,
    seed: user?.id || user?.email,
    getMediaUrl,
  });

  const loadData = async () => {
    try {
      const [{ profile: savedProfile, preferredModel }, loadedFaces] = await Promise.all([
        getVisualProfile(),
        listFaces(),
      ]);
      const resolvedModel = normalizePreferredAiModel(
        savedProfile?.preferredModel ?? preferredModel ?? user?.preferredModel
      );
      setProfile({
        ...EMPTY_PROFILE,
        ...(savedProfile || {}),
        preferredModel: resolvedModel,
      });
      setFaces(loadedFaces);
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
      const face = await uploadFace(file, consentAccepted);
      setFaces((prev) => [face, ...prev]);
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
    setDeletingFaceId(id);
    try {
      await deleteFace(id);
      setFaces((prev) => prev.filter((f) => f.id !== id));
      setFeedback({ type: 'ok', text: 'Foto removida permanentemente dos nossos servidores.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Não foi possível excluir a foto.',
      });
    } finally {
      setDeletingFaceId(null);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setFeedback(null);
    try {
      await saveVisualProfile(profile);
      await refreshUser();
      setFeedback({
        type: 'ok',
        text: `Perfil Visual atualizado com sucesso (${selectedModelOption.label}).`,
      });
      addToast({
        variant: 'success',
        title: 'Preferências salvas',
        description: `Modelo preferido definido para ${selectedModelOption.label}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text:
          err instanceof Error ? err.message : 'Não foi possível salvar o Perfil Visual.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-14 space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
        <div className="flex items-start sm:items-center gap-4">
          <ProfileAvatar
            faces={faces}
            seed={user?.id || user?.email}
            getMediaUrl={getMediaUrl}
            size="lg"
          />
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-violet-700 dark:text-[#8B5CF6]">
              Privado por padrão · LGPD
            </p>
            <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold text-slate-950 dark:text-white">
              Meu Perfil Visual
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-700 dark:text-[#A1A1AA] max-w-2xl">
              {avatarDisplay.isDefault
                ? `${avatarDisplay.label} em uso automaticamente até você enviar uma foto do seu rosto.`
                : 'Sua foto de referência facial ativa está pronta para preservar sua identidade em cada criação.'}
            </p>
          </div>
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
              ? 'bg-emerald-50 border-emerald-600/45 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-500/40 dark:text-emerald-200'
              : 'bg-red-50 border-red-600/45 text-red-950 dark:bg-red-950/40 dark:border-red-500/40 dark:text-red-200'
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
      <section className="rounded-2xl border border-slate-300 pf-card-surface dark:border-white/10 p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-4">
            <h2 className="font-display text-lg font-semibold text-slate-950 dark:text-white">
              Orientações para melhor preservação facial
            </h2>
            <ul className="space-y-2 text-sm text-slate-700 dark:text-[#A1A1AA]">
              <li>· Boa iluminação natural ou frontal sem sombras duras</li>
              <li>· Rosto bem visível e centralizado</li>
              <li>· Preferencialmente sem filtros de redes sociais</li>
              <li>· Evitar óculos escuros, bonés ou objetos cobrindo o rosto</li>
              <li>· Evitar fotos desfocadas ou em baixa resolução</li>
              <li>· Se possível, envie fotos frontais e em diferentes ângulos</li>
            </ul>
          </div>

          <div className="lg:col-span-7 space-y-5">
            <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-300 bg-slate-100 dark:border-white/10 dark:bg-[#08080C] cursor-pointer">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 rounded accent-[#7C3AED]"
              />
              <span className="text-xs sm:text-sm text-slate-800 dark:text-[#A1A1AA] leading-relaxed">
                Confirmo que esta foto é exclusivamente do meu próprio rosto (ou possuo autorização expressa), concordo com o processamento para geração de imagens conforme a{' '}
                <Link to="/lgpd" className="text-violet-700 dark:text-[#8B5CF6] underline">
                  LGPD
                </Link>{' '}
                e sei que minhas referências nunca são públicas nem usadas para treinar modelos.
              </span>
            </label>

            <label
              className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
                consentAccepted
                  ? 'border-violet-700/70 hover:border-violet-700 bg-violet-50/70 dark:border-[#7C3AED]/70 dark:hover:border-[#8B5CF6] dark:bg-[#08080C]/60 cursor-pointer'
                  : 'border-slate-300 bg-slate-100/60 dark:border-white/10 dark:bg-[#08080C]/30 opacity-75 cursor-not-allowed'
              }`}
            >
              {uploading ? (
                <ButtonSpinner size="md" className="w-6 h-6 text-violet-700 dark:text-[#8B5CF6]" />
              ) : (
                <Upload className="w-6 h-6 text-violet-700 dark:text-[#8B5CF6]" aria-hidden="true" />
              )}
              <div>
                <p className="text-sm font-medium text-slate-950 dark:text-white">
                  {uploading ? 'Validando e salvando foto...' : 'Selecionar foto do meu rosto'}
                </p>
                <p className="mt-1 text-xs text-slate-700 dark:text-[#A1A1AA]">JPG, PNG ou WebP até 6 MB</p>
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
        <div className="pt-4 border-t border-slate-300 dark:border-white/10">
          <h3 className="font-display text-sm font-semibold text-slate-950 dark:text-white mb-4">
            Minhas referências faciais ({faces.length})
          </h3>
          {loading ? (
            <div className="h-32 rounded-xl skeleton-violet" />
          ) : faces.length === 0 ? (
            <div
              data-testid="default-avatar-showcase"
              className="rounded-xl border border-slate-300 bg-slate-50 dark:border-white/10 dark:bg-[#08080C] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-5"
            >
              <div className="flex items-center gap-4">
                <ProfileAvatar
                  faces={faces}
                  seed={user?.id || user?.email}
                  getMediaUrl={getMediaUrl}
                  size="lg"
                />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">
                    {avatarDisplay.avatar?.name ?? 'Avatar padrão'} ativo no seu perfil
                  </p>
                  <p className="text-xs text-slate-700 dark:text-[#A1A1AA] max-w-md leading-relaxed">
                    Enquanto você ainda não envia uma foto do seu rosto, exibimos automaticamente este avatar abstrato exclusivo. Assim que enviar sua primeira selfie acima, ela passa a representar seu perfil.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0" aria-label="Série de avatares abstratos padrão">
                {DEFAULT_ABSTRACT_AVATARS.map((item) => {
                  const isCurrent = avatarDisplay.avatar?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      title={item.name}
                      className={`w-11 h-11 rounded-xl overflow-hidden border transition-all ${
                        isCurrent
                          ? 'border-violet-700 ring-2 ring-violet-600/35 dark:border-[#A855F7] dark:ring-[#A855F7]/35 scale-105'
                          : 'border-slate-300 opacity-75 dark:border-white/15'
                      }`}
                    >
                      <ImageWithFallback
                        src={item.src}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {faces.map((face) => (
                <div
                  key={face.id}
                  className="relative aspect-[3/4] rounded-xl overflow-hidden border border-slate-300 dark:border-white/10 bg-slate-900 dark:bg-[#08080C]"
                >
                  <ImageWithFallback
                    src={getMediaUrl(face.url)}
                    alt="Referência facial privada"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    disabled={deletingFaceId === face.id}
                    onClick={() => handleDeleteFace(face.id)}
                    aria-label="Excluir foto de referência"
                    className="absolute top-2 right-2 p-2 rounded-lg bg-[#08080C]/85 text-white hover:bg-red-600 disabled:opacity-60 transition-colors"
                  >
                    {deletingFaceId === face.id ? (
                      <ButtonSpinner size="md" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
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
      <section className="rounded-2xl border border-slate-300 pf-card-surface dark:border-white/10 p-6 sm:p-8">
        <h2 className="font-display text-lg font-semibold text-slate-950 dark:text-white">
          Características visuais opcionais
        </h2>
        <p className="mt-1 text-sm text-slate-700 dark:text-[#A1A1AA]">
          Esses campos complementam suas fotos de referência para manter consistência entre cenários.
        </p>

        <form onSubmit={handleSaveProfile} className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-[#08080C] px-4 py-3.5 space-y-2">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-slate-950 dark:text-white">
                Completude do Perfil Visual
              </span>
              <span className="font-mono-num text-slate-700 dark:text-[#A1A1AA] shrink-0">
                {completedItems} de 9 itens · {completionPercent}%
              </span>
            </div>
            <div
              className="h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden"
              role="progressbar"
              aria-valuenow={completionPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Completude do Perfil Visual"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#A855F7] to-[#EC4899] transition-all"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-600 dark:text-[#A1A1AA]">
              {filledTextFields} de 8 campos preenchidos ·{' '}
              {hasReferencePhoto
                ? `${faces.length} ${faces.length === 1 ? 'foto de referência' : 'fotos de referência'}`
                : 'nenhuma foto de referência ainda'}
            </p>
          </div>

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
          ].map((field) => (
            <div key={field.key} className="space-y-1.5">
              <label
                htmlFor={`vp-${field.key}`}
                className="block text-xs font-medium text-slate-700 dark:text-[#A1A1AA]"
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-950 placeholder:text-slate-500 dark:bg-[#08080C] dark:border-white/15 dark:text-white dark:placeholder:text-[#A1A1AA]/50 focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>
          ))}

          <div className="sm:col-span-2">
            <ExpandableTextField
              id="vp-otherCharacteristics"
              label="Outras características visuais"
              value={profile.otherCharacteristics || ''}
              onChange={(value) =>
                setProfile((prev) => ({ ...prev, otherCharacteristics: value }))
              }
              placeholder="Ex.: Tatuagem discreta no antebraço"
              defaultRows={2}
              expandedRows={5}
            />
          </div>

          <div className="sm:col-span-2 pt-4 mt-2 border-t border-slate-200 dark:border-white/10 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                  <Cpu className="w-4 h-4 text-violet-700 dark:text-[#8B5CF6]" aria-hidden="true" />
                  <span>Modelo de IA preferido para gerações futuras</span>
                </span>
                <p className="mt-0.5 text-xs text-slate-700 dark:text-[#A1A1AA]">
                  Define qual motor de geração será priorizado nas suas próximas fotografias e edições.
                  Só aparecem os modelos incluídos no seu plano.
                </p>
              </div>
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg border border-violet-600/40 bg-violet-50 text-[11px] font-medium text-violet-950 dark:border-[#8B5CF6]/45 dark:bg-[#7C3AED]/15 dark:text-violet-100">
                {selectedModelOption.badge}
              </span>
            </div>

            <div
              role="radiogroup"
              aria-label="Modelo de IA preferido para gerações futuras"
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {PREFERRED_AI_MODELS.filter((modelOption) =>
                allowedModelIds.includes(modelOption.id)
              ).map((modelOption) => {
                const selected = effectivePreferredModel === modelOption.id;
                return (
                  <button
                    key={modelOption.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() =>
                      setProfile((prev) => ({
                        ...prev,
                        preferredModel: modelOption.id,
                      }))
                    }
                    className={`text-left rounded-xl border p-4 space-y-1.5 transition-colors ${
                      selected
                        ? 'border-violet-600 bg-violet-50 dark:border-[#8B5CF6] dark:bg-[#7C3AED]/15'
                        : 'border-slate-300 bg-white hover:border-slate-400 dark:border-white/15 dark:bg-[#08080C] dark:hover:border-white/30'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-950 dark:text-white">
                        {modelOption.label}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-violet-600/40 bg-violet-50 text-[11px] font-medium text-violet-950 dark:border-[#8B5CF6]/45 dark:bg-[#7C3AED]/15 dark:text-violet-100 shrink-0">
                        {modelOption.badge}
                      </span>
                    </span>
                    <span className="block text-xs text-slate-700 dark:text-[#A1A1AA] leading-relaxed">
                      {modelOption.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="sm:col-span-2 pt-2 flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white hover:brightness-110 disabled:opacity-60"
            >
              {savingProfile && <ButtonSpinner size="sm" />}
              <span>{savingProfile ? 'Salvando...' : 'Salvar Perfil Visual'}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
