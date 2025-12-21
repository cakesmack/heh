import { useState, useEffect, useRef } from 'react';
import { Tag } from '@/types';
import { api } from '@/lib/api';

interface TagInputProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
}

export default function TagInput({ selectedTags, onChange, maxTags = 5 }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (inputValue.length < 2) {
      setSuggestions([]);
      return;
    }

    // Debounce API calls
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await api.tags.list(inputValue);
        setSuggestions(response.tags.filter(t => !selectedTags.includes(t.name)));
      } catch (error) {
        console.error('Failed to fetch tags:', error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue, selectedTags]);

  const addTag = (tagName: string) => {
    const normalized = tagName.toLowerCase().trim().replace(/\s+/g, '-');
    if (normalized && !selectedTags.includes(normalized) && selectedTags.length < maxTags) {
      onChange([...selectedTags, normalized]);
    }
    setInputValue('');
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const removeTag = (tagName: string) => {
    onChange(selectedTags.filter(t => t !== tagName));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1]);
    }
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Tags (max {maxTags})
      </label>

      <div className="flex flex-wrap gap-2 p-2 border rounded-lg bg-white min-h-[42px]">
        {selectedTags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-purple-600"
            >
              &times;
            </button>
          </span>
        ))}

        {selectedTags.length < maxTags && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(true);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={selectedTags.length === 0 ? "Add tags..." : ""}
            className="flex-1 min-w-[100px] outline-none text-sm"
          />
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => addTag(tag.name)}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 flex justify-between items-center"
            >
              <span>{tag.name}</span>
              <span className="text-gray-400 text-sm">{tag.usage_count} uses</span>
            </button>
          ))}
        </div>
      )}

      {selectedTags.length >= maxTags && (
        <p className="text-sm text-amber-600 mt-1">Maximum {maxTags} tags reached</p>
      )}
    </div>
  );
}
