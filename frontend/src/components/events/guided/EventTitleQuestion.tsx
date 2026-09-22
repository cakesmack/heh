import type { RefObject } from 'react';

interface EventTitleQuestionProps {
  value: string;
  error?: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
}

export function EventTitleQuestion({ value, error, inputRef, onChange }: EventTitleQuestionProps) {
  const descriptionId = error ? 'guided-title-help guided-title-error' : 'guided-title-help';

  return (
    <div className="space-y-3">
      <label htmlFor="guided-event-title" className="sr-only">
        Event title
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id="guided-event-title"
          name="guided-event-title"
          type="text"
          required
          maxLength={255}
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={descriptionId}
          placeholder="e.g. Inverness Winter Market"
          className={`w-full rounded-2xl border bg-white px-5 py-4 text-lg text-stone-dark shadow-sm transition-colors placeholder:text-gray-400 focus:border-moss-green focus:ring-2 focus:ring-moss-green/30 sm:text-xl ${
            error ? 'border-red-500' : 'border-gray-300 hover:border-gray-400'
          }`}
        />
        <span className="pointer-events-none absolute bottom-2.5 right-4 text-xs font-medium text-gray-400">
          {value.length}/255
        </span>
      </div>
      <p id="guided-title-help" className="text-sm leading-6 text-gray-600">
        Use the name visitors will recognise. You can refine it later.
      </p>
      {error && (
        <p id="guided-title-error" role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
