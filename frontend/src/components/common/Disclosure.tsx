import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const triggerId = `${id}-question`;
  const panelId = `${id}-answer`;

  return <div className="border-b border-gray-200 last:border-b-0">
    <h4>
      <button type="button" id={triggerId} aria-expanded={open} aria-controls={panelId}
        onClick={() => setOpen(current => !current)}
        className="flex min-h-12 w-full items-center justify-between gap-4 rounded-lg py-4 text-left text-sm font-semibold text-highland-green hover:text-moss-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss-green focus-visible:ring-offset-2 sm:text-base">
        <span className="min-w-0">{title}</span>
        <ChevronDown aria-hidden="true" className={`h-5 w-5 shrink-0 text-moss-green ${open ? 'rotate-180' : ''}`} />
      </button>
    </h4>
    <div id={panelId} aria-labelledby={triggerId} hidden={!open} className="space-y-3 pb-5 text-sm leading-7 text-gray-600 sm:text-base">
      {children}
    </div>
  </div>;
}
