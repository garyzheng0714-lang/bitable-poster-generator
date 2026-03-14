import * as fabric from 'fabric'

export interface TextboxWithBounds extends fabric.Textbox {
  placeholderBoxHeight?: number
}

export const MIN_TEXTBOX_WIDTH = 40
export const MIN_TEXTBOX_HEIGHT = 48
export const MIN_TEXT_FONT_SIZE = 8

function normalizeText(text?: string | null): string {
  if (!text || text.length === 0) return ' '
  return text
}

function fitsWithinHeight(textObj: TextboxWithBounds, height: number): boolean {
  return (textObj.height ?? 0) <= height + 0.5
}

export function getTextboxBounds(textObj: TextboxWithBounds): { width: number; height: number } {
  const width = Math.max(MIN_TEXTBOX_WIDTH, Math.round(textObj.width ?? MIN_TEXTBOX_WIDTH))
  const fallbackHeight = Math.max(
    MIN_TEXTBOX_HEIGHT,
    Math.round(textObj.height ?? 0),
    Math.round((textObj.fontSize ?? 36) * (textObj.lineHeight ?? 1.2) * 2.8),
  )

  return {
    width,
    height: Math.max(MIN_TEXTBOX_HEIGHT, Math.round(textObj.placeholderBoxHeight ?? fallbackHeight)),
  }
}

export function fitTextboxText(
  textObj: TextboxWithBounds,
  options?: {
    text?: string
    maxFontSize?: number
    minFontSize?: number
    preserveCenter?: boolean
  },
): { text: string; fontSize: number; width: number; height: number; truncated: boolean } {
  const { width, height } = getTextboxBounds(textObj)
  const center = options?.preserveCenter === false ? null : textObj.getCenterPoint()
  const sourceText = normalizeText(options?.text ?? textObj.text)
  const maxFontSize = Math.max(
    MIN_TEXT_FONT_SIZE,
    Math.round(options?.maxFontSize ?? textObj.fontSize ?? 36),
  )
  const minFontSize = Math.max(
    MIN_TEXT_FONT_SIZE,
    Math.min(maxFontSize, Math.round(options?.minFontSize ?? MIN_TEXT_FONT_SIZE)),
  )

  textObj.placeholderBoxHeight = height
  textObj.set({
    width,
    text: sourceText,
    splitByGrapheme: true,
    scaleX: 1,
    scaleY: 1,
  })

  let fitted = false
  for (let size = maxFontSize; size >= minFontSize; size -= 1) {
    textObj.set({ fontSize: size })
    textObj.initDimensions()
    if (fitsWithinHeight(textObj, height)) {
      fitted = true
      break
    }
  }

  let nextText = String(textObj.text ?? ' ')
  if (!fitted) {
    textObj.set({ fontSize: minFontSize })
    textObj.initDimensions()

    if (!fitsWithinHeight(textObj, height)) {
      const graphemes = Array.from(sourceText)
      let low = 0
      let high = graphemes.length
      let bestText = ' '

      while (low <= high) {
        const mid = Math.floor((low + high) / 2)
        const base = graphemes.slice(0, mid).join('').trimEnd()
        const candidate = mid >= graphemes.length ? sourceText : `${base || graphemes[0] || ''}…`

        textObj.set({ text: candidate || ' ' })
        textObj.initDimensions()

        if (fitsWithinHeight(textObj, height)) {
          bestText = candidate || ' '
          low = mid + 1
        } else {
          high = mid - 1
        }
      }

      nextText = bestText
      textObj.set({ text: nextText })
      textObj.initDimensions()
    }
  }

  if (center) {
    textObj.setPositionByOrigin(center, 'center', 'center')
  }
  textObj.setCoords()

  return {
    text: String(textObj.text ?? ' '),
    fontSize: Math.round(textObj.fontSize ?? maxFontSize),
    width,
    height,
    truncated: nextText !== sourceText,
  }
}
