import { resolveProfileAvatarDisplay, type ProfileFaceLike } from '../shared/defaultAvatars';
import { ImageWithFallback } from './ImageWithFallback';

interface ProfileAvatarProps {
  faces?: readonly ProfileFaceLike[] | null;
  seed?: string | null;
  getMediaUrl?: (path: string) => string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<ProfileAvatarProps['size']>, string> = {
  sm: 'w-11 h-11 rounded-xl',
  md: 'w-14 h-14 rounded-2xl',
  lg: 'w-20 h-20 rounded-2xl',
  xl: 'w-28 h-28 rounded-2xl',
};

export function ProfileAvatar({
  faces,
  seed,
  getMediaUrl,
  size = 'md',
  className = '',
}: ProfileAvatarProps) {
  const resolved = resolveProfileAvatarDisplay({
    faces,
    seed,
    getMediaUrl,
  });

  return (
    <div
      data-testid="profile-avatar"
      data-avatar-kind={resolved.isDefault ? 'default-abstract' : 'user-face'}
      data-avatar-id={resolved.avatar?.id ?? 'uploaded-face'}
      className={`relative shrink-0 overflow-hidden border border-violet-600/35 dark:border-[#8B5CF6]/45 bg-[#08080C] shadow-md shadow-[#7C3AED]/15 ${SIZE_CLASSES[size]} ${className}`.trim()}
    >
      <ImageWithFallback
        src={resolved.src}
        alt={resolved.label}
        referrerPolicy="no-referrer"
        className={`w-full h-full object-cover ${resolved.isDefault ? 'object-center' : 'object-top'}`}
      />
    </div>
  );
}
