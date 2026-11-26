export interface DefaultAbstractAvatar {
  id: string;
  name: string;
  description: string;
  src: string;
}

export interface ProfileFaceLike {
  id?: string;
  url: string;
}

export const DEFAULT_ABSTRACT_AVATARS: readonly DefaultAbstractAvatar[] = [
  {
    id: 'violet-prism',
    name: 'Prisma Violeta',
    description: 'Vidro translúcido dobrado com refração violeta e magenta em estúdio.',
    src: '/src/assets/images/avatar_violet_prism_1795696004715.jpg',
  },
  {
    id: 'liquid-silk',
    name: 'Seda Líquida',
    description: 'Ondas fluidas acetinadas em índigo e lavanda sob iluminação cinematográfica.',
    src: '/src/assets/images/avatar_liquid_silk_1795696006068.jpg',
  },
  {
    id: 'eclipse-halo',
    name: 'Halo Eclipse',
    description: 'Esfera minimalista em obsidiana com halo luminoso violeta e ouro rosé.',
    src: '/src/assets/images/avatar_eclipse_halo_1795696005797.jpg',
  },
  {
    id: 'chromatic-glass',
    name: 'Cristal Cromático',
    description: 'Monólito facetado em quartzo translúcido com brilho champanhe e ametista.',
    src: '/src/assets/images/avatar_chromatic_glass_1795696006562.jpg',
  },
];

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function selectDefaultAbstractAvatar(seed?: string | null): DefaultAbstractAvatar {
  const normalized = typeof seed === 'string' ? seed.trim().toLowerCase() : '';
  if (!normalized) {
    return DEFAULT_ABSTRACT_AVATARS[0];
  }
  const index = stableHash(normalized) % DEFAULT_ABSTRACT_AVATARS.length;
  return DEFAULT_ABSTRACT_AVATARS[index];
}

export interface ResolvedProfileAvatar {
  isDefault: boolean;
  src: string;
  label: string;
  avatar: DefaultAbstractAvatar | null;
}

export function resolveProfileAvatarDisplay(params: {
  faces?: readonly ProfileFaceLike[] | null;
  seed?: string | null;
  getMediaUrl?: (path: string) => string;
}): ResolvedProfileAvatar {
  const faces = params.faces ?? [];
  const firstFace = faces.find((face) => Boolean(face && typeof face.url === 'string' && face.url.trim()));
  if (firstFace) {
    const resolvedSrc = params.getMediaUrl
      ? params.getMediaUrl(firstFace.url)
      : firstFace.url;
    return {
      isDefault: false,
      src: resolvedSrc,
      label: 'Foto de referência ativa',
      avatar: null,
    };
  }

  const avatar = selectDefaultAbstractAvatar(params.seed);
  return {
    isDefault: true,
    src: avatar.src,
    label: `Avatar padrão · ${avatar.name}`,
    avatar,
  };
}
