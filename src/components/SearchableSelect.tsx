import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SearchableSelectProps {
  ariaLabel: string;
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  emptyMessage: string;
  disabled?: boolean;
}

export default function SearchableSelect({
  ariaLabel,
  options,
  value,
  onChange,
  placeholder,
  emptyMessage,
  disabled = false,
}: SearchableSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selected = options.find((option) => option.value === value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) =>
      `${option.label} ${option.description || ''}`.toLowerCase().includes(normalizedQuery),
    );
  }, [options, query]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const choose = (option: SearchableSelectOption) => {
    onChange(option.value);
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-controls={listboxId}
          aria-expanded={open}
          aria-autocomplete="list"
          aria-activedescendant={
            open && filteredOptions[activeIndex]
              ? `${listboxId}-${filteredOptions[activeIndex].value}`
              : undefined
          }
          disabled={disabled}
          value={open ? query : selected?.label || ''}
          placeholder={placeholder}
          onFocus={() => {
            setOpen(true);
            setQuery('');
            setActiveIndex(0);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) =>
                Math.min(index + 1, Math.max(0, filteredOptions.length - 1)),
              );
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === 'Enter' && open && filteredOptions[activeIndex]) {
              event.preventDefault();
              choose(filteredOptions[activeIndex]);
            } else if (event.key === 'Escape') {
              setOpen(false);
              setQuery('');
              setActiveIndex(0);
            }
          }}
          className="config-input !px-9 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        />
        {value && !disabled ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label={`Clear ${ariaLabel.toLowerCase()}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        )}
      </div>

      {open && !disabled && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 z-40 mt-1.5 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
        >
          {filteredOptions.length === 0 ? (
            <p className="px-3 py-5 text-center text-xs text-slate-400">{emptyMessage}</p>
          ) : (
            filteredOptions.map((option, index) => (
              <button
                key={option.value}
                id={`${listboxId}-${option.value}`}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition ${
                  activeIndex === index ? 'bg-violet-50' : 'hover:bg-slate-50'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-slate-800">
                    {option.label}
                  </span>
                  {option.description && (
                    <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                      {option.description}
                    </span>
                  )}
                </span>
                {option.value === value && <Check className="h-3.5 w-3.5 shrink-0 text-violet-600" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
