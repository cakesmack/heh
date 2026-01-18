/**
 * RichTextEditor Component
 * Lightweight Tiptap-based rich text editor with Bold, Italics, Lists, Links
 */

'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { useCallback, useEffect } from 'react';

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    onFocus?: () => void;
    placeholder?: string;
    className?: string;
}

export default function RichTextEditor({
    value,
    onChange,
    onFocus,
    placeholder = 'Write your description...',
    className = '',
}: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                bulletList: { keepMarks: true },
                orderedList: { keepMarks: true },
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-emerald-600 underline hover:text-emerald-700',
                },
            }),
        ],
        content: value,
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none min-h-[120px] px-3 py-2',
            },
        },
        onFocus: () => {
            if (onFocus) onFocus();
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    // Sync external value changes
    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            editor.commands.setContent(value);
        }
    }, [value, editor]);

    const setLink = useCallback(() => {
        if (!editor) return;

        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('Enter URL:', previousUrl);

        if (url === null) return;

        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }, [editor]);

    if (!editor) {
        return (
            <div className={`border border-gray-300 rounded-lg bg-gray-50 min-h-[150px] ${className}`}>
                <div className="animate-pulse p-3">Loading editor...</div>
            </div>
        );
    }

    return (
        <div className={`border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 ${className}`}>
            {/* Toolbar */}
            <div className="flex items-center gap-1 p-2 border-b border-gray-200 bg-gray-50">
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive('bold') ? 'bg-gray-200 text-emerald-600' : 'text-gray-600'
                        }`}
                    title="Bold"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
                        <path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
                    </svg>
                </button>

                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive('italic') ? 'bg-gray-200 text-emerald-600' : 'text-gray-600'
                        }`}
                    title="Italic"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M19 4h-9M14 20H5M15 4L9 20" />
                    </svg>
                </button>

                <div className="w-px h-5 bg-gray-300 mx-1" />

                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive('bulletList') ? 'bg-gray-200 text-emerald-600' : 'text-gray-600'
                        }`}
                    title="Bullet List"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                    </svg>
                </button>

                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive('orderedList') ? 'bg-gray-200 text-emerald-600' : 'text-gray-600'
                        }`}
                    title="Numbered List"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
                    </svg>
                </button>

                <div className="w-px h-5 bg-gray-300 mx-1" />

                <button
                    type="button"
                    onClick={setLink}
                    className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive('link') ? 'bg-gray-200 text-emerald-600' : 'text-gray-600'
                        }`}
                    title="Add Link"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                    </svg>
                </button>
            </div>

            {/* Editor Content */}
            <div className="bg-white">
                <EditorContent editor={editor} />
                {!value && (
                    <div className="absolute top-[50px] left-3 text-gray-400 pointer-events-none">
                        {placeholder}
                    </div>
                )}
            </div>
        </div>
    );
}
