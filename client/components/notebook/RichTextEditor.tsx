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
import { useTranslation } from 'react-i18next'
import type { Editor } from '@tiptap/react'

// Import ProseMirror table CSS for base table styling (borders, resize handles, selected cell overlay)
import 'prosemirror-tables/style/tables.css'

/* ── Types ── */

interface RichTextEditorProps {
  readonly content: string
  readonly onChange: (html: string) => void
  readonly placeholder?: string
  readonly editable?: boolean
}

/* ── Toolbar button ── */

interface ToolbarButtonProps {
  readonly onClick: () => void
  readonly isActive?: boolean
  readonly label: string
  readonly disabled?: boolean
  readonly children: React.ReactNode
}

function ToolbarButton({ onClick, isActive = false, label, disabled = false, children }: Readonly<ToolbarButtonProps>) {
  const { t } = useTranslation()
  const activeClass = isActive
    ? 'bg-accent/15 text-accent'
    : 'text-muted-foreground hover:text-foreground hover:bg-hover'
  const variantClass = disabled ? 'text-muted-foreground opacity-50 cursor-not-allowed' : activeClass
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`p-1.5 rounded-md transition-colors ${variantClass}`}
      aria-label={label}
      title={disabled ? t('campaign:readOnlyTooltip') : label}
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

export function RichTextEditor({ content, onChange, placeholder, editable = true }: Readonly<RichTextEditorProps>) {
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const editorRef = useRef<Editor | null>(null)
  const { t } = useTranslation()
  const resolvedPlaceholder = placeholder ?? t('notebook:startWriting')

  const editor = useEditor({
    shouldRerenderOnTransaction: true,
    editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        link: false,
        underline: false,
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
      Placeholder.configure({ placeholder: resolvedPlaceholder }),
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
        {t('notebook:loadingEditor')}
      </div>
    )
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-input/30">
      {/* ── Toolbar ── */}
      <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-b border-border bg-surface/50">
        {/* Headings */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} label={t('notebook:heading1')} disabled={!editable}>
          <span className="text-xs font-bold">H1</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} label={t('notebook:heading2')} disabled={!editable}>
          <span className="text-xs font-bold">H2</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} label={t('notebook:heading3')} disabled={!editable}>
          <span className="text-xs font-bold">H3</span>
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Text formatting */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} label={t('notebook:bold')} disabled={!editable}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 4h6a4 4 0 014 4 4 4 0 01-4 4H6zM6 12h8a4 4 0 014 4 4 4 0 01-4 4H6z" /></svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} label={t('notebook:italic')} disabled={!editable}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 4h8m-4-4l-4 16m-4 0h8" /></svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} label={t('notebook:underline')} disabled={!editable}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 3v7a5 5 0 0010 0V3M4 21h16" /></svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} label={t('notebook:strikethrough')} disabled={!editable}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M12 4v16" /></svg>
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Lists */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} label={t('notebook:bulletList')} disabled={!editable}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16M8 6V4m0 4v-2m0 2h8m-8 2v2m0-2H4m12 0h4m-8 4v2" /></svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} label={t('notebook:orderedList')} disabled={!editable}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive('taskList')} label={t('notebook:checklist')} disabled={!editable}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Blocks */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} label={t('notebook:blockquote')} disabled={!editable}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16M8 6V4m0 4v-2m0 2h8m-8 2v2m0-2H4m12 0h4m-8 4v2" /></svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} label={t('notebook:codeBlock')} disabled={!editable}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} label={t('notebook:horizontalRule')} disabled={!editable}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16" /></svg>
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Link & Table */}
        <ToolbarButton onClick={handleOpenLinkDialog} isActive={editor.isActive('link')} label={t('notebook:link')} disabled={!editable}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
        </ToolbarButton>
        <ToolbarButton onClick={handleInsertTable} label={t('notebook:insertTable')} disabled={!editable}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        </ToolbarButton>

        {/* ── Table operations (visible only when cursor is inside a table) ── */}
        {editor.isActive('table') && (
          <>
            <ToolbarSeparator />

            <ToolbarButton
              onClick={() => editor.chain().focus().addRowBefore().run()}
              label={t('notebook:addRowAbove')}
              disabled={!editable}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M3 20h18M3 8h18v8H3V8z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 8v-4" />
              </svg>
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().addRowAfter().run()}
              label={t('notebook:addRowBelow')}
              disabled={!editable}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M3 20h18M3 8h18v8H3V8z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20v-4" />
              </svg>
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().addColumnBefore().run()}
              label={t('notebook:addColumnBefore')}
              disabled={!editable}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 3v18M20 3v18M8 3v18h8V3H8z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H4" />
              </svg>
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              label={t('notebook:addColumnAfter')}
              disabled={!editable}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 3v18M20 3v18M8 3v18h8V3H8z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7h4" />
              </svg>
            </ToolbarButton>

            <ToolbarSeparator />

            <ToolbarButton
              onClick={() => editor.chain().focus().deleteRow().run()}
              label={t('notebook:deleteRow')}
              disabled={!editable}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M3 20h18M3 8h18v8H3V8z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h12" />
              </svg>
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().deleteColumn().run()}
              label={t('notebook:deleteColumn')}
              disabled={!editable}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 3v18M20 3v18M8 3v18h8V3H8z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12" />
              </svg>
            </ToolbarButton>

            <ToolbarSeparator />

            <ToolbarButton
              onClick={() => editor.chain().focus().mergeCells().run()}
              label={t('notebook:mergeCells')}
              disabled={!editable}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6v12" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 10h4" />
              </svg>
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().splitCell().run()}
              label={t('notebook:splitCell')}
              disabled={!editable}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6v12" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 6v12" />
              </svg>
            </ToolbarButton>

            <ToolbarSeparator />

            <ToolbarButton
              onClick={() => editor.chain().focus().deleteTable().run()}
              label={t('notebook:deleteTable')}
              disabled={!editable}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 4l-4 4m0-4l4 4" />
              </svg>
            </ToolbarButton>
          </>
        )}
      </div>

      {/* ── Link dialog ── */}
      {isLinkDialogOpen && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface/30">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder={t('notebook:linkUrlPlaceholder')}
            className="flex-1 px-2 py-1 text-sm rounded bg-input border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleApplyLink()
              if (e.key === 'Escape') setIsLinkDialogOpen(false)
            }}
          />
          <button onClick={handleApplyLink} className="btn-primary !py-1 !px-2.5 !text-xs">
            {t('common:apply')}
          </button>
          <button onClick={() => setIsLinkDialogOpen(false)} className="btn-ghost !py-1 !px-2.5 !text-xs">
            {t('common:cancel')}
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
