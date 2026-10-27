import { useState } from 'react';
import { normaliseCollectionKeywords } from '@/lib/collectionKeywords';

export default function CollectionKeywordInput({ keywords, onChange }: { keywords: string[]; onChange: (keywords: string[]) => void }) {
  const [input, setInput] = useState('');
  const add = (value: string) => {
    onChange(normaliseCollectionKeywords([...keywords, ...value.split(',')]));
    setInput('');
  };
  return <div>
    <label htmlFor="collection-keywords" className="mb-1 block text-xs font-medium text-gray-500">Search Keywords (Title/Description/Tags)</label>
    <div className="flex min-h-[42px] flex-wrap items-center gap-2 rounded-lg border bg-white p-2">
      {keywords.map(keyword => <span key={keyword.toLowerCase()} className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-1 text-sm text-purple-800">
        {keyword}<button type="button" aria-label={`Remove keyword ${keyword}`} onClick={() => onChange(keywords.filter(term => term !== keyword))}
          className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full hover:text-purple-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600">×</button>
      </span>)}
      <input id="collection-keywords" type="text" value={input} aria-describedby="collection-keywords-help"
        onChange={event => event.target.value.includes(',') ? add(event.target.value) : setInput(event.target.value)}
        onKeyDown={event => {
          if (!event.nativeEvent.isComposing && (event.key === 'Enter' || event.key === ',')) {
            event.preventDefault(); add(input);
          }
        }}
        onBlur={() => { if (input.trim()) add(input); }}
        placeholder="e.g. Christmas, Santa, Xmas" className="min-w-[120px] flex-1 rounded px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
    </div>
    <p id="collection-keywords-help" className="mt-1 text-xs text-gray-500">Press Enter or comma to add a term. Phrases stay together. Match ALL/ANY applies to each term.</p>
  </div>;
}
