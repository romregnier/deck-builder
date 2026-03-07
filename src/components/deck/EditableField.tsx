/**
 * EditableField.tsx — Composant d'édition inline pour le canvas
 * DB-01-A Phase 1 — Inline Edit Canvas
 *
 * Wraps un élément quelconque (h1, p, div, etc.) avec support contentEditable.
 * En mode editMode=false, se comporte exactement comme l'élément natif.
 * En mode editMode=true, le double-clic active l'édition inline.
 */
import React, { useRef, useEffect, useCallback } from 'react'

export interface EditableFieldProps {
  value: string
  onSave: (v: string) => void
  multiline?: boolean
  as?: keyof React.JSX.IntrinsicElements
  style?: React.CSSProperties
  className?: string
  fieldId: string
  selected?: boolean
  editMode?: boolean
  placeholder?: string
  onDoubleClick?: () => void
}

export function EditableField({
  value,
  onSave,
  multiline = false,
  as: Tag = 'div',
  style,
  className,
  fieldId,
  selected,
  editMode,
  placeholder,
  onDoubleClick: externalDoubleClick,
}: EditableFieldProps) {
  const ref = useRef<HTMLElement>(null)
  const savedRef = useRef(value)   // valeur au moment du focus (pour Escape)
  const isEditing = useRef(false)

  // Sync value quand elle change externement (autre agent, etc.)
  useEffect(() => {
    if (ref.current && !isEditing.current) {
      ref.current.textContent = value || ''
    }
    savedRef.current = value
  }, [value])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!editMode) return
    e.stopPropagation()
    if (!ref.current) return
    if (externalDoubleClick) externalDoubleClick()
    ref.current.contentEditable = 'true'
    ref.current.focus()
    // Placer le curseur à la fin
    const range = document.createRange()
    range.selectNodeContents(ref.current)
    range.collapse(false)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    isEditing.current = true
  }, [editMode, externalDoubleClick])

  const handleBlur = useCallback(() => {
    if (!ref.current) return
    ref.current.contentEditable = 'false'
    isEditing.current = false
    const newValue = ref.current.textContent || ''
    if (newValue !== savedRef.current) {
      savedRef.current = newValue
      onSave(newValue)
    }
  }, [onSave])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isEditing.current) return
    if (e.key === 'Escape') {
      e.preventDefault()
      if (ref.current) {
        ref.current.textContent = savedRef.current
        ref.current.contentEditable = 'false'
        ref.current.blur()
      }
      isEditing.current = false
    }
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault()
      ref.current?.blur()
    }
  }, [multiline])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }, [])

  const editableStyle: React.CSSProperties = editMode ? {
    cursor: 'text',
    outline: selected ? '1.5px solid #E11F7B' : 'none',
    outlineOffset: 3,
    borderRadius: 4,
    caretColor: '#E11F7B',
    minWidth: 20,
    borderBottom: '1px dashed rgba(225,31,123,0.35)',
    ...(style || {}),
  } : (style || {})

  return React.createElement(Tag as string, {
    ref,
    className,
    style: editableStyle,
    onDoubleClick: handleDoubleClick,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    onPaste: handlePaste,
    'data-field-id': fieldId,
    suppressContentEditableWarning: true,
    children: value || placeholder || '',
  } as React.HTMLAttributes<HTMLElement> & { ref: React.Ref<HTMLElement> })
}

export default EditableField
