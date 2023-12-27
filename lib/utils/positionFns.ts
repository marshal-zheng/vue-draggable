import get from 'lodash/get'
import { getTouch, innerHeight, innerWidth, offsetXYFromParent, outerHeight, outerWidth } from './domFns'
import { int, isNum } from './shims'

import { Bounds, ControlPosition, DraggableData, MouseTouchEvent, DraggableCoreProps, Kv } from './types'

export function getBoundPosition (draggable: Kv, x: number, y: number): [number, number] {
  // If no bounds, short-circuit and move on
  if (!draggable.props.bounds) return [x, y]

  // Clone new bounds
  let bounds: Kv = draggable.props.bounds
  bounds = typeof bounds === 'string' ? bounds : cloneBounds(bounds)
  const node = findDOMNode(draggable)

  const {ownerDocument} = node
  const ownerWindow = get(node , 'ownerWindow') as any
  const defaultView = get(node, 'ownerWindow.defaultView')
  if (defaultView && typeof bounds === 'string') {
    let boundNode
    if (bounds === 'parent') {
      boundNode = node.parentNode
    } else {
      boundNode = ownerDocument.querySelector(bounds)
    }
    if (!(boundNode instanceof ownerWindow.HTMLElement)) {
      throw new Error(`Bounds selector ${bounds as any} could not find an element.`)
    }
    const nodeStyle: CSSStyleDeclaration = ownerWindow.getComputedStyle(node) as CSSStyleDeclaration
    const boundNodeStyle: CSSStyleDeclaration = ownerWindow.getComputedStyle(boundNode) as CSSStyleDeclaration
    // Compute bounds. This is a pain with padding and offsets but this gets it exactly right.
    bounds = {
      left: -node.offsetLeft + int(boundNodeStyle.paddingLeft) + int(nodeStyle.marginLeft),
      top: -node.offsetTop + int(boundNodeStyle.paddingTop) + int(nodeStyle.marginTop),
      right: innerWidth(boundNode as HTMLElement) - outerWidth(node) - node.offsetLeft +
        int(boundNodeStyle.paddingRight) - int(nodeStyle.marginRight),
      bottom: innerHeight(boundNode as HTMLElement) - outerHeight(node) - node.offsetTop +
        int(boundNodeStyle.paddingBottom) - int(nodeStyle.marginBottom)
    }
  }

  // Keep x and y below right and bottom limits...
  if (isNum(bounds.right)) x = Math.min(x, (bounds.right as number))
  if (isNum(bounds.bottom)) y = Math.min(y, (bounds.bottom as number))

  // But above left and top limits.
  if (isNum(bounds.left)) x = Math.max(x, (bounds.left as number))
  if (isNum(bounds.top)) y = Math.max(y, (bounds.top as number))

  return [x, y]
}

export function snapToGrid (grid: [number, number], pendingX: number, pendingY: number): [number, number] {
  const x = Math.round(pendingX / grid[0]) * grid[0]
  const y = Math.round(pendingY / grid[1]) * grid[1]
  return [x, y]
}

export function canDragX (draggable: Kv): boolean {
  return draggable.props.axis === 'both' || draggable.props.axis === 'x'
}

export function canDragY (draggable: Kv): boolean {
  return draggable.props.axis === 'both' || draggable.props.axis === 'y'
}

// Get {x, y} positions from event.
export function getControlPosition (e: MouseTouchEvent, draggableCore: any, touchIdentifier?: number | null): ControlPosition | null {
  const touchObj = typeof touchIdentifier === 'number' ? getTouch(e, touchIdentifier) : null
  if (typeof touchIdentifier === 'number' && !touchObj) return null // not the right touch
  const node: HTMLElement = findDOMNode(draggableCore)
  // User can provide an offsetParent if desired.
  const offsetParent = draggableCore.props.offsetParent || node.offsetParent || node.ownerDocument.body
  return offsetXYFromParent(touchObj || e, offsetParent as HTMLElement, draggableCore.props.scale as number)
}

// Create an data object exposed by <DraggableCore>'s events
export function createCoreData (draggable: Kv, x: number, y: number): DraggableData {
  const state = draggable.state
  const isStart = !isNum(state.lastX)
  const node = findDOMNode(draggable)

  if (isStart) {
    // If this is our first move, use the x and y as last coords.
    return {
      node,
      deltaX: 0, deltaY: 0,
      lastX: x, lastY: y,
      x, y,
    }
  } else {
    return {
      node,
      deltaX: x - state.lastX, deltaY: y - state.lastY,
      lastX: state.lastX, lastY: state.lastY,
      x, y,
    }
  }
}

// Create an data exposed by <Draggable>'s events
export function createDraggableData (draggable: Kv, coreData: DraggableData): DraggableData {
  const scale = draggable.props.scale
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

// A lot faster than stringify/parse
function cloneBounds (bounds: Bounds): Bounds {
  return {
    left: bounds.left,
    top: bounds.top,
    right: bounds.right,
    bottom: bounds.bottom
  }
}

function findDOMNode (draggable: any): HTMLElement {
  const node: HTMLElement = draggable.findDOMNode()
  if (!node) {
    throw new Error('<DraggableCore>: Unmounted during event!')
  }
  return node
}
