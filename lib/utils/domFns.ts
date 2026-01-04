/**
 * Provides utility functions for DOM manipulation and event handling.
 */

import browserPrefix, {browserPrefixToKey} from './getPrefix'
import { findInArray, int, isFunction } from './shims'

import { ControlPosition, MouseTouchEvent, MouseTouchPointerEvent, PositionOffsetControlPosition, EventHandler, CompatibleElement } from './types'

const transformKey = browserPrefixToKey('transform', browserPrefix)

type OffsetParentRect = { left: number; top: number }

type OffsetParentRectCacheEntry = {
  rect: OffsetParentRect | null
  rafId: number | null
}

const zeroOffsetParentRect: OffsetParentRect = { left: 0, top: 0 }
const offsetParentRectCache = new WeakMap<HTMLElement, OffsetParentRectCacheEntry>()

const getOffsetParentRect = (offsetParent: HTMLElement): OffsetParentRect => {
  const ownerDocument = offsetParent.ownerDocument
  if (offsetParent === ownerDocument.body) return zeroOffsetParentRect

  let entry = offsetParentRectCache.get(offsetParent)
  if (!entry) {
    entry = { rect: null, rafId: null }
    offsetParentRectCache.set(offsetParent, entry)
  }

  const cached = entry.rect
  if (cached) return cached

  const rect = offsetParent.getBoundingClientRect()
  const nextRect: OffsetParentRect = { left: rect.left, top: rect.top }
  entry.rect = nextRect

  if (entry.rafId == null) {
    const ownerWindow = ownerDocument.defaultView
    if (ownerWindow?.requestAnimationFrame) {
      entry.rafId = ownerWindow.requestAnimationFrame(() => {
        entry.rect = null
        entry.rafId = null
      })
    } else {
      entry.rect = null
    }
  }

  return nextRect
}

/**
 * Cached method name for matchesSelector.
 */
let matchesSelectorFunc = ''

/**
 * Checks if the element matches the given CSS selector.
 * 
 * @param el - The element to check.
 * @param selector - The CSS selector to match against.
 * @returns True if the element matches the selector, false otherwise.
 */
export const matchesSelector = (el: Node, selector: string): boolean => {
  if (!matchesSelectorFunc) {
    matchesSelectorFunc = findInArray([
      'matches',
      'webkitMatchesSelector',
      'mozMatchesSelector',
      'msMatchesSelector',
      'oMatchesSelector'
    ], function (method: string){
      return isFunction(el[method])
    })
  }

  if (!isFunction(el[matchesSelectorFunc])) return false

  return el[matchesSelectorFunc](selector)
}

/**
 * Checks if the element or any of its parents match the given CSS selector.
 * 
 * @param el - The element to start the search from.
 * @param selector - The CSS selector to match against.
 * @param baseNode - The base node to stop the search at.
 * @returns True if a match is found, false otherwise.
 */
export const matchesSelectorAndParentsTo = (el: Node, selector: string, baseNode: Node): boolean => {
  let node = el
  do {
    if (matchesSelector(node, selector)) return true
    if (node === baseNode) return false
    node = node.parentNode as Node
  } while (node)

  return false
}

/**
 * Adds an event listener to an element.
 * 
 * @param el - The element to add the event listener to.
 * @param event - The event type to listen for.
 * @param handler - The function to call when the event occurs.
 * @param inputOptions - Optional parameters for the event listener.
 */
export const addEvent = (el: CompatibleElement, event: string, handler: EventHandler<MouseTouchPointerEvent>, inputOptions?: AddEventListenerOptions): void => {
  if (!el) return
  const options = {capture: true, ...inputOptions}
  if (el.addEventListener) {
    el.addEventListener(event, handler as EventListener, options)
  } else if (el.attachEvent) {
    el.attachEvent(`on${event}`, handler as EventListener)
  } else {
    el[`on${event}`] = handler
  }
}

/**
 * Removes an event listener from an element.
 * 
 * @param el - The element to remove the event listener from.
 * @param event - The event type of the listener to remove.
 * @param handler - The function that was called when the event occurred.
 * @param inputOptions - Optional parameters for the event listener.
 */
export const removeEvent = (el: CompatibleElement, event: string, handler: EventHandler<MouseTouchPointerEvent>, inputOptions?: AddEventListenerOptions): void => {
  if (!el) return
  const options = {capture: true, ...inputOptions}
  if (el.removeEventListener) {
    el.removeEventListener(event, handler as EventListener, options)
  } else if (el.detachEvent) {
    el.detachEvent?.('on' + event, handler as EventListener)
  } else {
    el[`on${event}`] = null
  }
}

/**
 * Calculates the outer height of an element, including padding and border.
 * 
 * @param node - The element to calculate the outer height of.
 * @returns The outer height of the element.
 */
export const outerHeight = (node: HTMLElement): number => {
  let height = node.clientHeight
  const computedStyle = node.ownerDocument.defaultView?.getComputedStyle(node) as CSSStyleDeclaration
  height += int(computedStyle.borderTopWidth)
  height += int(computedStyle.borderBottomWidth)
  return height
}

/**
 * Calculates the outer width of an element, including padding and border.
 * 
 * @param node - The element to calculate the outer width of.
 * @returns The outer width of the element.
 */
export const outerWidth = (node: HTMLElement): number => {
  let width: number = node.clientWidth
  const computedStyle = node.ownerDocument?.defaultView?.getComputedStyle(node) as CSSStyleDeclaration
  width += int(computedStyle.borderLeftWidth)
  width += int(computedStyle.borderRightWidth)
  return width
}

/**
 * Calculates the inner height of an element, excluding padding.
 * 
 * @param node - The element to calculate the inner height of.
 * @returns The inner height of the element.
 */
export const innerHeight = (node: HTMLElement): number => {
  let height: number = node.clientHeight
  const computedStyle = node.ownerDocument?.defaultView?.getComputedStyle(node) as CSSStyleDeclaration
  height -= int(computedStyle.paddingTop)
  height -= int(computedStyle.paddingBottom)
  return height
}

/**
 * Calculates the inner width of an element, excluding padding.
 * 
 * @param node - The element to calculate the inner width of.
 * @returns The inner width of the element.
 */
export const innerWidth = (node: HTMLElement): number => {
  let width = node.clientWidth
  const computedStyle = node.ownerDocument?.defaultView?.getComputedStyle(node) as CSSStyleDeclaration
  width -= int(computedStyle.paddingLeft)
  width -= int(computedStyle.paddingRight)
  return width
}

/**
 * Calculates the X and Y offset of an event from the parent element.
 * 
 * @param evt - The event object.
 * @param offsetParent - The parent element to calculate the offset from.
 * @param scale - The scale factor to apply to the offset.
 * @returns The X and Y offset from the parent element.
 */
export const offsetXYFromParent = (evt: {clientX: number, clientY: number}, offsetParent: HTMLElement, scale: number): ControlPosition => {
  const offsetParentRect = getOffsetParentRect(offsetParent)

  const x = (evt.clientX + offsetParent.scrollLeft - offsetParentRect.left) / scale
  const y = (evt.clientY + offsetParent.scrollTop - offsetParentRect.top) / scale

  return {x, y}
}

/**
 * Generates a CSS transform string from a position and offset.
 * 
 * @param controlPos - The position of the control.
 * @param positionOffset - The offset to apply to the position.
 * @param unitSuffix - The unit to use for the position values.
 * @returns A CSS transform string.
 */
export const getTranslation = ({x, y}: ControlPosition, positionOffset: PositionOffsetControlPosition, unitSuffix: string): string => {
  let translation = `translate(${x}${unitSuffix},${y}${unitSuffix})`
  if (positionOffset) {
    const defaultX = `${(typeof positionOffset.x === 'string') ? positionOffset.x : positionOffset.x + unitSuffix}`
    const defaultY = `${(typeof positionOffset.y === 'string') ? positionOffset.y : positionOffset.y + unitSuffix}`
    translation = `translate(${defaultX}, ${defaultY})` + translation
  }
  return translation
}

/**
 * Creates a CSS transform property for a given position and offset.
 * 
 * @param controlPos - The control position.
 * @param positionOffset - The position offset.
 * @returns An object with a single property for CSS transform.
 */
export const createCSSTransform = (controlPos: ControlPosition, positionOffset: PositionOffsetControlPosition): unknown => {
  const translation = getTranslation(controlPos, positionOffset, 'px')
  return {[transformKey]: translation }
}

/**
 * Creates an SVG transform attribute value for a given position and offset.
 * 
 * @param controlPos - The control position.
 * @param positionOffset - The position offset.
 * @returns A string for the SVG transform attribute.
 */
export const createSVGTransform = (controlPos: ControlPosition, positionOffset: PositionOffsetControlPosition): string => {
  const translation = getTranslation(controlPos, positionOffset, '')
  return translation
}

/**
 * Retrieves the touch object with a specific identifier from an event.
 * 
 * @param e - The event object.
 * @param identifier - The identifier of the touch object to retrieve.
 * @returns The touch object, or null if not found.
 */
export const getTouch = (e: MouseTouchEvent, identifier: number): {clientX: number, clientY: number} => {
  return (e.targetTouches && findInArray(e.targetTouches, (t: Touch) => identifier === t.identifier)) ||
         (e.changedTouches && findInArray(e.changedTouches, (t: Touch) => identifier === t.identifier))
}

/**
 * Retrieves the identifier of the first touch point from an event.
 * 
 * @param e - The event object.
 * @returns The identifier of the first touch point, or null if not available.
 */
export const getTouchIdentifier = (e: MouseTouchEvent): number | null => {
  if (e.targetTouches && e.targetTouches[0]) return e.targetTouches[0].identifier
  if (e.changedTouches && e.changedTouches[0]) return e.changedTouches[0].identifier
  return null
}

/**
 * Adds a class name to an element.
 * 
 * @param el - The element to add the class name to.
 * @param className - The class name to add.
 */
export const addClassName = (el: HTMLElement, className: string) => {
  if (el.classList) {
    el.classList.add(className)
  } else {
    if (!el.className.match(new RegExp(`(?:^|\\s)${className}(?!\\S)`))) {
      el.className += ` ${className}`
    }
  }
}

/**
 * Removes a class name from an element.
 * 
 * @param el - The element to remove the class name from.
 * @param className - The class name to remove.
 */
export const removeClassName = (el: HTMLElement, className: string) => {
  if (el.classList) {
    el.classList.remove(className)
  } else {
    el.className = el.className.replace(new RegExp(`(?:^|\\s)${className}(?!\\S)`, 'g'), '')
  }
}

/**
 * Adds styles to prevent user selection during drag operations.
 * 
 * @param doc - The document to add the styles to. Optional.
 */
export const addUserSelectStyles = (doc?: Document) => {
  if (!doc) return
  let styleEl = <HTMLStyleElement> doc.getElementById('vue-draggable-style-el')
  if (!styleEl) {
    styleEl = doc.createElement('style')
    styleEl.type = 'text/css'
    styleEl.id = 'vue-draggable-style-el'
    styleEl.innerHTML = '.vue-draggable-transparent-selection *::-moz-selection {all: inherit;}\n'
    styleEl.innerHTML += '.vue-draggable-transparent-selection *::selection {all: inherit;}\n'
    doc.getElementsByTagName('head')[0].appendChild(styleEl)
  }
  if (doc.body) addClassName(doc.body, 'vue-draggable-transparent-selection')
}

/**
 * Removes styles added to prevent user selection during drag operations.
 * 
 * @param doc - The document to remove the styles from. Optional.
 */
export const removeUserSelectStyles = (doc?: Document) => {
  if (!doc) return
  if (doc.body) removeClassName(doc.body, 'vue-draggable-transparent-selection');
  const selection = doc.getSelection?.();
  if (selection && selection.type !== 'Caret') {
    selection.removeAllRanges();
  }
}
