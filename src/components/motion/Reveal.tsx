/**
 * Ölçülü hareket bileşenleri. prefers-reduced-motion açıksa transform yapılmaz, yalnızca içerik görünür.
 */
import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';
import type { ReactNode } from 'react';

const EASE = [0.22, 1, 0.36, 1] as const;

export function Reveal({
  children, delay = 0, y = 28, className, as = 'div', amount = 0.25,
}: { children: ReactNode; delay?: number; y?: number; className?: string; as?: 'div' | 'section' | 'li' | 'article' | 'header'; amount?: number }) {
  const reduce = useReducedMotion();
  const Comp = motion[as] as typeof motion.div;
  if (reduce) {
    const Plain = as;
    return <Plain className={className}>{children}</Plain>;
  }
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </Comp>
  );
}

/** Başlık satırlarını sırayla açığa çıkarır (maske içinde yukarı kayma) */
export function StaggerLines({ lines, className, lineClassName, delay = 0.15 }: { lines: ReactNode[]; className?: string; lineClassName?: (i: number) => string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <span className={className}>
      {lines.map((line, i) => (
        <span key={i} className="-mb-[0.16em] block overflow-hidden pb-[0.16em]">
          {reduce ? (
            <span className={`block ${lineClassName?.(i) ?? ''}`}>{line}</span>
          ) : (
            <motion.span
              className={`block ${lineClassName?.(i) ?? ''}`}
              initial={{ y: '105%' }}
              animate={{ y: 0 }}
              transition={{ duration: 1.1, delay: delay + i * 0.14, ease: EASE }}
            >
              {line}
            </motion.span>
          )}
        </span>
      ))}
    </span>
  );
}

export function FadeIn({ children, delay = 0, className, ...rest }: { children: ReactNode; delay?: number; className?: string } & Omit<HTMLMotionProps<'div'>, 'children'>) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export { EASE };
