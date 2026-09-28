import { Info } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

interface InfoHintProps {
  label: string;
  children: string;
}

export function InfoHint({ label, children }: InfoHintProps) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const open = hovered || pinned;

  useEffect(() => {
    if (!pinned) return undefined;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setPinned(false);
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [pinned]);

  return (
    <span
      ref={containerRef}
      style={{ display: 'inline-flex', position: 'relative', verticalAlign: 'middle' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        aria-controls={tooltipId}
        aria-expanded={open}
        aria-label={`Ayuda: ${label}`}
        className="icon-button"
        onBlur={() => setHovered(false)}
        onClick={(event) => {
          event.stopPropagation();
          setPinned((current) => !current);
        }}
        onFocus={() => setHovered(true)}
        title={`Información: ${label}`}
        type="button"
        style={{ display: 'inline-grid', height: 24, placeItems: 'center', width: 24 }}
      >
        <Info aria-hidden="true" size={15} />
      </button>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          style={{
            background: 'var(--navy-950)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-md)',
            color: 'var(--white)',
            fontSize: 12,
            fontWeight: 500,
            left: 0,
            lineHeight: 1.45,
            maxWidth: 'min(320px, 80vw)',
            minWidth: 240,
            padding: '9px 11px',
            position: 'absolute',
            top: 'calc(100% + 6px)',
            whiteSpace: 'normal',
            zIndex: 30,
          }}
        >
          {children}
        </span>
      )}
    </span>
  );
}
