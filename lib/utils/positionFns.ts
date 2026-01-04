import { getTouch, offsetXYFromParent } from './domFns'
import { isNum } from './shims'

import { Bounds, ControlPosition, DraggableData, MouseTouchEvent, MouseTouchPointerEvent } from './types'

type HasAxis = {
  props: {
    axis?: unknown
  }
}

type HasBounds = {
  props: {
    bounds?: Bounds | string | false
  }
  findDOMNode: () => HTMLElement | null
  __boundsCache?: {
    key: string
    node: HTMLElement | null
    boundEl: HTMLElement | null
    boundClientWidth: number
    boundClientHeight: number
    nodeClientWidth: number
    nodeClientHeight: number
    bounds: Bounds | null
  }
}

type HasControlPosition = {
  props: {
    offsetParent?: HTMLElement
    scale?: unknown
  }
  findDOMNode: () => HTMLElement | null
}

type HasCoreData = {
  props?: unknown
  state: {
    lastX: number
    lastY: number
  }
  findDOMNode: () => HTMLElement | null
}

type HasDraggableData = {
  props: {
    scale?: unknown
  }
  state: {
    x: number
    y: number
  }
}

const selectorBoundsCache = new WeakMap<HTMLElement, Map<string, Element | null>>();

const getCachedBoundElement = (node: HTMLElement, selector: string, ownerDocument: Document): Element | null => {
  let perNode = selectorBoundsCache.get(node);
  if (!perNode) {
    perNode = new Map<string, Element | null>();
    selectorBoundsCache.set(node, perNode);
  }

  if (perNode.has(selector)) {
    const cached = perNode.get(selector) || null;
    if (cached === null) return null;
    if (ownerDocument.contains(cached)) return cached;
  }

  const next = ownerDocument.querySelector(selector);
  perNode.set(selector, next);
  return next;
}

// Ever got annoyed by CSS values being strings? Yeah, me too. This function takes those strings and turns them into numbers.
// Also, it warns you if something's not right, which is pretty handy.
const parseStyleToInt = (style: CSSStyleDeclaration, property: keyof CSSStyleDeclaration): number => {
  if (!(property in style)) {
    return 0;
  }

  const value = style[property];
  const parsed = parseInt(value as string, 10);

  if (isNaN(parsed)) {
    return 0;
  }

  return parsed;
}

// This is where the magic happens. We're making sure the draggable stays within its bounds.
// It's a bit of math and some conditionals. Nothing too scary, but it does the job.
export const getBoundPosition = (draggable: HasBounds, x: number, y: number): [number, number] => {
  if (!draggable.props.bounds) return [x, y]

  const boundsProp = draggable.props.bounds
  const node = draggable.findDOMNode()
  if (!node) return [x, y]

  const { ownerDocument } = node;
  const ownerWindow = ownerDocument?.defaultView;
  if (!ownerWindow) {
    return [x, y];
  }

  let bounds: Bounds;
  if (typeof boundsProp === 'string') {
    const cacheKey = boundsProp
    const cache = draggable.__boundsCache
    if (
      cache &&
      cache.key === cacheKey &&
      cache.node === node &&
      cache.boundEl &&
      cache.bounds &&
      cache.boundClientWidth === cache.boundEl.clientWidth &&
      cache.boundClientHeight === cache.boundEl.clientHeight &&
      cache.nodeClientWidth === node.clientWidth &&
      cache.nodeClientHeight === node.clientHeight
    ) {
      bounds = cache.bounds
    } else {
    const boundNode = boundsProp === 'parent'
      ? node.parentNode
      : getCachedBoundElement(node, boundsProp, ownerDocument);
    if (!(boundNode instanceof ownerWindow.HTMLElement)) {
      throw new Error(`Bounds selector "${boundsProp}" could not find an element.`);
    }
    const nodeStyle = ownerWindow.getComputedStyle(node);
    const boundNodeStyle = ownerWindow.getComputedStyle(boundNode);

    const boundPaddingLeft = parseStyleToInt(boundNodeStyle, 'paddingLeft')
    const boundPaddingRight = parseStyleToInt(boundNodeStyle, 'paddingRight')
    const boundPaddingTop = parseStyleToInt(boundNodeStyle, 'paddingTop')
    const boundPaddingBottom = parseStyleToInt(boundNodeStyle, 'paddingBottom')

    const nodeMarginLeft = parseStyleToInt(nodeStyle, 'marginLeft')
    const nodeMarginRight = parseStyleToInt(nodeStyle, 'marginRight')
    const nodeMarginTop = parseStyleToInt(nodeStyle, 'marginTop')
    const nodeMarginBottom = parseStyleToInt(nodeStyle, 'marginBottom')

    const nodeBorderLeft = parseStyleToInt(nodeStyle, 'borderLeftWidth')
    const nodeBorderRight = parseStyleToInt(nodeStyle, 'borderRightWidth')
    const nodeBorderTop = parseStyleToInt(nodeStyle, 'borderTopWidth')
    const nodeBorderBottom = parseStyleToInt(nodeStyle, 'borderBottomWidth')

    const boundInnerWidth = boundNode.clientWidth - boundPaddingLeft - boundPaddingRight
    const boundInnerHeight = boundNode.clientHeight - boundPaddingTop - boundPaddingBottom
    const nodeOuterWidth = node.clientWidth + nodeBorderLeft + nodeBorderRight
    const nodeOuterHeight = node.clientHeight + nodeBorderTop + nodeBorderBottom

    bounds = {
      left: -node.offsetLeft + boundPaddingLeft + nodeMarginLeft,
      top: -node.offsetTop + boundPaddingTop + nodeMarginTop,
      right: boundInnerWidth - nodeOuterWidth - node.offsetLeft + boundPaddingRight - nodeMarginRight,
      bottom: boundInnerHeight - nodeOuterHeight - node.offsetTop + boundPaddingBottom - nodeMarginBottom
    };
    if (cache) {
      cache.key = cacheKey
      cache.node = node
      cache.boundEl = boundNode
      cache.boundClientWidth = boundNode.clientWidth
      cache.boundClientHeight = boundNode.clientHeight
      cache.nodeClientWidth = node.clientWidth
      cache.nodeClientHeight = node.clientHeight
      cache.bounds = bounds
    }
    }
  } else {
    bounds = boundsProp;
  }

  // Clamp x and y to be within the bounds (only when provided).
  if (typeof bounds.left === 'number') x = Math.max(x, bounds.left);
  if (typeof bounds.right === 'number') x = Math.min(x, bounds.right);
  if (typeof bounds.top === 'number') y = Math.max(y, bounds.top);
  if (typeof bounds.bottom === 'number') y = Math.min(y, bounds.bottom);

  return [x, y];
};

// Snapping to a grid is super useful for aligning stuff. This function just rounds the position to the nearest grid point.
export const snapToGrid = (grid: [number, number], pendingX: number, pendingY: number): [number, number] => {
  const x = Math.round(pendingX / grid[0]) * grid[0]
  const y = Math.round(pendingY / grid[1]) * grid[1]
  return [x, y]
}

// Can we drag along the x-axis? This checks the draggable's props to see what's allowed.
export const canDragX = (draggable: HasAxis): boolean => {
  return draggable.props.axis === 'both' || draggable.props.axis === 'x'
}

// Same as canDragX, but for the y-axis. Gotta keep things flexible.
export const canDragY = (draggable: HasAxis): boolean => {
  return draggable.props.axis === 'both' || draggable.props.axis === 'y'
}

// Getting the control position is a bit of DOM manipulation and event handling.
// It's a bit dense, but it's just calculating positions based on the event and the draggable's state.
export const getControlPosition = (e: MouseTouchPointerEvent, draggableCore: HasControlPosition, touchIdentifier?: number | null): ControlPosition | null => {
  const touchObj = typeof touchIdentifier === 'number' ? getTouch(e as MouseTouchEvent, touchIdentifier) : null
  if (typeof touchIdentifier === 'number' && !touchObj) return null // not the right touch
  const node = draggableCore.findDOMNode()
  if (!node) return null
  // User can provide an offsetParent if desired.
  const offsetParent = draggableCore.props.offsetParent || node.offsetParent || node.ownerDocument.body
  const scale = typeof draggableCore.props.scale === 'number' ? draggableCore.props.scale : 1
  return offsetXYFromParent((touchObj || e) as {clientX: number, clientY: number}, offsetParent as HTMLElement, scale)
}

// When you start dragging, or move the draggable, this function updates the state with the new position.
// It's a bit of a state management thing, keeping track of deltas and positions.
export const createCoreData = (draggable: HasCoreData, x: number, y: number): DraggableData => {
  const state = draggable.state
  const isStart = !isNum(state.lastX)
  const node = draggable.findDOMNode()
  if (!node) {
    throw new Error('<DraggableCore> not mounted on DragStart!')
  }

  if (isStart) {
    // If this is our first move, use the x and y as last coords.
    return {
      node,
      deltaX: 0, deltaY: 0,
      lastX: x, lastY: y,
      x, y,
    }
  } else {
    // Otherwise, calculate the delta.
    return {
      node,
      deltaX: x - state.lastX, deltaY: y - state.lastY,
      lastX: state.lastX, lastY: state.lastY,
      x, y,
    }
  }
}

// This takes the core data and adjusts it based on the draggable's scale.
// It's for when you're scaling the draggable and need the position to reflect that.
export const createDraggableData = (draggable: HasDraggableData, coreData: DraggableData): DraggableData => {
  const scale = typeof draggable.props.scale === 'number' ? draggable.props.scale : 1
  return {
    node: coreData.node,
    x: draggable.state.x + (coreData.deltaX / scale),
    y: draggable.state.y + (coreData.deltaY / scale),
    deltaX: (coreData.deltaX / scale),
    deltaY: (coreData.deltaY / scale),
    lastX: draggable.state.x,
    lastY: draggable.state.y
  }
}
