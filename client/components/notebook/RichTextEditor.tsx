'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import CodeBlock from '@tiptap/extension-code-block'
import Blockquote from '@tiptap/extension-blockquote'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import Placeholder from '@tiptap/extension-placeholder'
import { useCallback, useEffect, useState, useRef } from 'react'
import type { Editor } from '@tiptap/react'

/* ── Types ── */

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

/* ── Toolbar button ── */

interface ToolbarButtonProps {
  onClick: () => void
  isActive?: boolean
  label: string
  children: React.ReactNode
}

function ToolbarButton({ onClick, isActive = false, label, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-1.5 rounded-md transition-colors ${
        isActive
          ? 'bg-accent/15 text-accent'
          : 'text-muted-foreground hover:text-foreground hover:bg-hover'
      }`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  )
}

/* ── Toolbar separator ── */

function ToolbarSeparator() {
  return <div className="w-px h-5 bg-border mx-0.5 shrink-0" />
}

/* ── Component ── */

export function RichTextEditor({ content, onChange, placeholder = 'Start writing...' }: RichTextEditorProps) {
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const editorRef = useRef<Editor | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-accent underline hover:text-accent/80 cursor-pointer' },
      }),
      TaskList.configure({ HTMLAttributes: { class: 'not-prose pl-0' } }),
      TaskItem.configure({ nested: true, HTMLAttributes: { class: 'flex items-start gap-2 my-1' } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      CodeBlock.configure({ HTMLAttributes: { class: 'bg-code p-3 rounded-lg text-sm font-mono overflow-x-auto' } }),
      Blockquote.configure({ HTMLAttributes: { class: 'border-l-4 border-accent/30 pl-4 italic text-muted-foreground my-4' } }),
      HorizontalRule.configure({ HTMLAttributes: { class: 'my-6 border-border' } }),
      Placeholder.configure({ placeholder }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] text-foreground [&_p]:text-foreground [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_li]:text-foreground [&_pre]:bg-code [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:text-sm [&_code]:text-foreground [&_ul]:list-disc [&_ol]:list-decimal [&_ul_ul]:list-circle [&_a]:text-accent [&_a]:underline',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML())
    },
  })

  // Store editor reference
  useEffect(() => {
    if (editor) {
      editorRef.current = editor
    }
  }, [editor])

  // Sync external content changes into the editor without overwriting user edits
  useEffect(() => {
    if (editor && content && editor.getHTML() !== content) {
      editor.commands.setContent(content, { emitUpdate: false })
    }
  }, [editor, content])

  /* ── Link handling ── */

  const handleOpenLinkDialog = useCallback(() => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href
    setLinkUrl(previousUrl ?? '')
    setIsLinkDialogOpen(true)
  }, [editor])

  const handleApplyLink = useCallback(() => {
    if (!editor) return
    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run()
    }
    setIsLinkDialogOpen(false)
    setLinkUrl('')
  }, [editor, linkUrl])

  /* ── Table insertion ── */

  const handleInsertTable = useCallback(() => {
    if (!editor) return
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }, [editor])

  if (!editor) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-muted-foreground text-sm">
        Loading editor...
      </div>
    )
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-input/30">
      {/* ── Toolbar ── */}
      <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b border-border bg-surface/50">
        {/* Headings */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} label="Heading 1">
          <span className="text-xs font-bold">H1</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} label="Heading 2">
          <span className="text-xs font-bold">H2</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} label="Heading 3">
          <span className="text-xs font-bold">H3</span>
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Text formatting */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} label="Bold">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 4h6a4 4 0 014 4 4 4 0 01-4 4H6zM6 12h8a4 4 0 014 4 4 4 0 01-4 4H6z" /></svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} label="Italic">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 4h8m-4-4l-4 16m-4 0h8" /></svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} label="Underline">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 3v7a5 5 0 0010 0V3M4 21h16" /></svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} label="Strikethrough">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M12 4v16" /></svg>
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Lists */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} label="Bullet list">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16M8 6V4m0 4v-2m0 2h8m-8 2v2m0-2H4m12 0h4m-8 4v2" /></svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} label="Ordered list">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive('taskList')} label="Checklist">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Blocks */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} label="Blockquote">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16M8 6V4m0 4v-2m0 2h8m-8 2v2m0-2H4m12 0h4m-8 4v2" /></svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} label="Code block">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} label="Horizontal rule">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16" /></svg>
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Link & Table */}
        <ToolbarButton onClick={handleOpenLinkDialog} isActive={editor.isActive('link')} label="Link">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
        </ToolbarButton>
        <ToolbarButton onClick={handleInsertTable} label="Insert table">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        </ToolbarButton>
      </div>

      {/* ── Link dialog ── */}
      {isLinkDialogOpen && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface/30">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 px-2 py-1 text-sm rounded bg-input border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleApplyLink()
              if (e.key === 'Escape') setIsLinkDialogOpen(false)
            }}
          />
          <button onClick={handleApplyLink} className="btn-primary !py-1 !px-2.5 !text-xs">
            Apply
          </button>
          <button onClick={() => setIsLinkDialogOpen(false)} className="btn-ghost !py-1 !px-2.5 !text-xs">
            Cancel
          </button>
        </div>
      )}

      {/* ── Editor content ── */}
      <div className="px-4 py-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
