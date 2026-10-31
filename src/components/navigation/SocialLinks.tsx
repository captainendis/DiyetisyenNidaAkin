import type { SocialLinks as Social } from '@shared/site-config';
import { InstagramIcon, LinkedinIcon, XIcon, YoutubeIcon } from '@/components/icons/SocialIcons';
import { cn } from '@/lib/text';

const ITEMS = [
  { key: 'instagram', label: 'Instagram', Icon: InstagramIcon },
  { key: 'youtube', label: 'YouTube', Icon: YoutubeIcon },
  { key: 'x', label: 'X', Icon: XIcon },
  { key: 'linkedin', label: 'LinkedIn', Icon: LinkedinIcon },
] as const;

/** Yalnızca yapılandırılmış hesapları gösterir; hiçbiri yoksa hiçbir şey çizmez */
export function SocialLinks({ social, className }: { social: Social; className?: string }) {
  const items = ITEMS.filter((i) => social[i.key]);
  if (!items.length) return null;
  return (
    <ul className={cn('flex items-center gap-1', className)}>
      {items.map(({ key, label, Icon }) => (
        <li key={key}>
          <a href={social[key]!} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex h-10 w-10 items-center justify-center rounded-full text-cream/70 transition-colors hover:bg-cream/5 hover:text-rose">
            <Icon className="h-5 w-5" />
          </a>
        </li>
      ))}
    </ul>
  );
}
