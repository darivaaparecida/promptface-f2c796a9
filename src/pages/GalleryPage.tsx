import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Heart, Images, MessageCircle, Share2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  listCommunityGallery,
  toggleCommunityLike,
  type CommunityGalleryItem,
} from '../lib/db';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { buildWhatsAppShareUrl } from '../shared/socialShare';

/**
 * Galeria da Comunidade — página pública. Só aparecem as fotos que o dono
 * optou por compartilhar; a galeria começa vazia de verdade (sem exemplos).
 * Curtir exige login e leva para /login quando não logado.
 */
export function GalleryPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<CommunityGalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [likingIds, setLikingIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listCommunityGallery();
        if (!cancelled) setItems(list);
      } catch {
        if (!cancelled) {
          setLoadError('Não foi possível carregar a galeria. Tente novamente em instantes.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLike = async (item: CommunityGalleryItem) => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (likingIds.includes(item.id)) return;
    setLikingIds((prev) => [...prev, item.id]);
    try {
      const liked = await toggleCommunityLike(item.id);
      setItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                likedByMe: liked,
                likesCount: Math.max(0, entry.likesCount + (liked ? 1 : -1)),
              }
            : entry
        )
      );
    } catch (error) {
      addToast({
        variant: 'info',
        title: 'Não foi possível curtir',
        description:
          error instanceof Error ? error.message : 'Tente novamente em instantes.',
      });
    } finally {
      setLikingIds((prev) => prev.filter((id) => id !== item.id));
    }
  };

  const handleShare = async (item: CommunityGalleryItem) => {
    const galleryUrl = `${window.location.origin}/galeria`;
    const shareText = `Veja esta foto "${item.scenarioTitle}" na Galeria da Comunidade do PromptFace: ${galleryUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'PromptFace — Galeria da Comunidade', text: shareText, url: galleryUrl });
        return;
      } catch {
        // Cai para copiar o link.
      }
    }
    try {
      await navigator.clipboard.writeText(galleryUrl);
      setCopiedId(item.id);
      addToast({
        variant: 'success',
        title: 'Link copiado!',
        description: 'O link da galeria foi copiado para a área de transferência.',
      });
      window.setTimeout(() => setCopiedId((prev) => (prev === item.id ? null : prev)), 2500);
    } catch {
      addToast({
        variant: 'info',
        title: 'Copie o link manualmente',
        description: galleryUrl,
      });
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-14 space-y-5 sm:space-y-8">
      <header>
        <h1 className="font-display text-2xl sm:text-4xl font-bold text-slate-950 dark:text-white">
          Galeria da Comunidade
        </h1>
        <p className="mt-2 text-sm text-slate-700 dark:text-[#A1A1AA] leading-relaxed max-w-2xl">
          As melhores fotos criadas com o PromptFace, compartilhadas por quem criou.
          Só aparecem aqui as fotos que o dono optou por publicar — curta as suas
          favoritas e inspire-se para a próxima criação.
        </p>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div
              key={index}
              className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface overflow-hidden animate-pulse"
            >
              <div className="aspect-[3/4] bg-slate-200 dark:bg-white/10" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-white/10" />
                <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface p-8 text-center">
          <p className="text-sm text-slate-700 dark:text-[#A1A1AA]">{loadError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider text-white bg-gradient-to-r from-[#A855F7] to-[#EC4899] hover:brightness-110"
          >
            Tentar novamente
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface p-8 sm:p-12 text-center">
          <span className="mx-auto inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white">
            <Images className="w-7 h-7" aria-hidden="true" />
          </span>
          <h2 className="mt-4 font-display text-lg font-semibold text-slate-950 dark:text-white">
            Nenhuma foto pública ainda — seja o primeiro a compartilhar!
          </h2>
          <p className="mt-2 text-sm text-slate-700 dark:text-[#A1A1AA] leading-relaxed max-w-md mx-auto">
            Crie sua foto, abra o visualizador no Meu Espaço e ative
            &ldquo;Compartilhar na Galeria&rdquo;. Ela aparece aqui para toda a comunidade.
          </p>
          <Link
            to="/criar"
            className="mt-6 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider text-white bg-gradient-to-r from-[#A855F7] to-[#EC4899] shadow-lg shadow-[#7C3AED]/25 hover:brightness-110"
          >
            Criar minha primeira foto
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const liking = likingIds.includes(item.id);
            const whatsappUrl = buildWhatsAppShareUrl({
              scenarioTitle: item.scenarioTitle,
              categoryName: item.categoryName,
              appUrl: `${window.location.origin}/galeria`,
            });
            return (
              <article
                key={item.id}
                className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface overflow-hidden"
              >
                <ImageWithFallback
                  src={item.imageUrl}
                  alt={`Foto "${item.scenarioTitle}" criada por ${item.authorName}`}
                  className="w-full aspect-[3/4] object-cover"
                />
                <div className="p-4">
                  <h2 className="font-display text-base font-semibold text-slate-950 dark:text-white truncate">
                    {item.scenarioTitle}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-700 dark:text-[#A1A1AA]">
                    {item.categoryName} · por {item.authorName}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={liking}
                      aria-pressed={item.likedByMe}
                      aria-label={
                        item.likedByMe
                          ? 'Remover curtida desta foto'
                          : 'Curtir esta foto'
                      }
                      onClick={() => void handleLike(item)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors disabled:opacity-60 ${
                        item.likedByMe
                          ? 'bg-pink-50 border-pink-600 text-pink-950 dark:bg-[#EC4899]/15 dark:border-[#EC4899] dark:text-white'
                          : 'border-slate-300 bg-slate-100 text-slate-800 hover:text-slate-950 dark:border-white/15 dark:bg-[#08080C] dark:text-[#A1A1AA] dark:hover:text-white'
                      }`}
                    >
                      <Heart
                        className={`w-4 h-4 ${item.likedByMe ? 'fill-[#EC4899] text-[#EC4899]' : ''}`}
                        aria-hidden="true"
                      />
                      <span className="font-mono-num">{item.likesCount}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleShare(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-slate-100 text-xs font-medium text-slate-800 hover:text-slate-950 dark:border-white/15 dark:bg-[#08080C] dark:text-[#A1A1AA] dark:hover:text-white"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                      ) : (
                        <Share2 className="w-4 h-4" aria-hidden="true" />
                      )}
                      <span>{copiedId === item.id ? 'Copiado!' : 'Compartilhar'}</span>
                    </button>
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Compartilhar no WhatsApp"
                      className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-emerald-700/45 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/50 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
