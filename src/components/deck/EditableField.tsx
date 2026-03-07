/**
 * EditableField.tsx — Composant d'édition inline pour le canvas
 * DB-01-A Phase 1 — Inline Edit Canvas
 * DB-01-C — Clic simple (plus de double-clic)
 * DB-13 — Boutons A−/A+ pour redimensionner le texte inline
 *
 * Wraps un élément quelconque (h1, p, div, etc.) avec support contentEditable.
 * En mode editMode=false, se comporte exactement comme l'élément natif.
 * En mode editMode=true, le clic simple active l'édition inline.
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
  /** @deprecated — appelé depuis onClick désormais (plus besoin de double-clic) */
  onDoubleClick?: () => void
  /** Prop directe pour notifier le parent du champ sélectionné */
  onFieldSelect?: (fieldId: string) => void
  // DB-13 — Redimensionner le texte inline
  onUpdateFontSize?: (path: string, delta: number) => void
}

const microBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.2)',
  color: '#fff',
  borderRadius: 4,
  padding: '1px 5px',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  lineHeight: '16px',
  fontFamily: 'Poppins, sans-serif',
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
  onDoubleClick: externalClick,
  onFieldSelect,
  onUpdateFontSize,
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

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!editMode) return
    e.stopPropagation()
    if (!ref.current) return
    // Sélectionner le champ (via onDoubleClick compat ou onFieldSelect direct)
    if (externalClick) externalClick()
    onFieldSelect?.(fieldId)
    // Activer contentEditable seulement si pas déjà actif
    if (ref.current.contentEditable === 'true') return
    ref.current.contentEditable = 'true'
    ref.current.focus()
    // Placer le curseur à la fin
    const range = document.createRange()
    range.selectNodeContents(ref.current)
    range.collapse(false)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)
    isEditing.current = true
  }, [editMode, fieldId, externalClick, onFieldSelect])

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

  const el = React.createElement(Tag as string, {
    ref,
    className,
    style: editableStyle,
    onClick: handleClick,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    onPaste: handlePaste,
    'data-field-id': fieldId,
    suppressContentEditableWarning: true,
    children: value || placeholder || '',
  } as React.HTMLAttributes<HTMLElement> & { ref: React.Ref<HTMLElement> })

  // DB-13 — Micro-toolbar A−/A+ quand sélectionné
  if (selected && editMode && onUpdateFontSize) {
    return (
      <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', width: style?.width === '100%' || style?.flex === '1' ? '100%' : undefined }}>
        {/* Floating toolbar */}
        <div
          style={{
            position: 'absolute', top: -28, left: 0,
            display: 'flex', gap: 2,
            background: 'rgba(0,0,0,0.85)', borderRadius: 4, padding: '2px 4px',
            zIndex: 200,
            pointerEvents: 'auto',
          }}
          onMouseDown={e => e.preventDefault()} // empêche blur de l'éditeur
        >
          <button
            onClick={e => { e.stopPropagation(); onUpdateFontSize(fieldId, -1) }}
            style={microBtnStyle}
            title="Réduire la taille"
          >A−</button>
          <button
            onClick={e => { e.stopPropagation(); onUpdateFontSize(fieldId, +1) }}
            style={microBtnStyle}
            title="Agrandir la taille"
          >A+</button>
        </div>
        {el}
      </div>
    )
  }

  return el
}

export default EditableField
