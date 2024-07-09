import { getTouch, innerHeight, innerWidth, offsetXYFromParent, outerHeight, outerWidth } from './domFns'
import { isNum } from './shims'

import { Bounds, ControlPosition, DraggableData, MouseTouchEvent } from './types'
import Draggable from '../Draggable'
import DraggableCore from '../DraggableCore'

type DraggableInstance = typeof Draggable
type DraggableCoreInstance = typeof DraggableCore

// Quick clone for bounds. We're doing this because we don't want to mess with the original bounds object.
// It's a simple copy, nothing fancy.
const cloneBounds = (bounds: Bounds): Bounds => {
  return {
    left: bounds.left,
    top: bounds.top,
    right: bounds.right,
    bottom: bounds.bottom
  }
}

// This one's a bit tricky. We're trying to find the actual DOM node for a draggable component.
// It's using some internal stuff, so don't worry if it looks a bit weird.
const findDOMNode = (draggable: Partial<DraggableInstance> | Partial<DraggableCoreInstance>): HTMLElement => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return draggable.findDOMNode()
}

// Ever got annoyed by CSS values being strings? Yeah, me too. This function takes those strings and turns them into numbers.
// Also, it warns you if something's not right, which is pretty handy.
const parseStyleToInt = (style: CSSStyleDeclaration, property: keyof CSSStyleDeclaration): number => {
  if (!(property in style)) {
    console.warn(`Property "${String(property)}" does not exist on the provided style object.`);
    return 0;
  }

  const value = style[property];
  const parsed = parseInt(value as string, 10);

  if (isNaN(parsed)) {
    console.warn(`Value of property "${String(property)}" is not a valid number.`);
    return 0;
  }

  return parsed;
}

// This is where the magic happens. We're making sure the draggable stays within its bounds.
// It's a bit of math and some conditionals. Nothing too scary, but it does the job.
export const getBoundPosition = (draggable: Partial<DraggableInstance>, x: number, y: number): [number, number] => {
  if (!draggable.props.bounds) return [x, y];

  let bounds = draggable.props.bounds as Bounds;
  bounds = typeof bounds === 'string' ? bounds : cloneBounds(bounds);
  const node = findDOMNode(draggable);
  if (!node) return [x, y];

  const { ownerDocument } = node;
  const ownerWindow = ownerDocument?.defaultView;
  if (!ownerWindow) {
    return [x, y];
  }

  if (typeof bounds === 'string') {
    const boundNode = bounds === 'parent' ? node.parentNode : ownerDocument.querySelector(bounds);
    if (!(boundNode instanceof ownerWindow.HTMLElement)) {
      throw new Error(`Bounds selector "${bounds as unknown as string}" could not find an element.`);
    }
    const nodeStyle = ownerWindow.getComputedStyle(node);
    const boundNodeStyle = ownerWindow.getComputedStyle(boundNode);

    bounds = {
      left: -node.offsetLeft + parseStyleToInt(boundNodeStyle, 'paddingLeft') + parseStyleToInt(nodeStyle, 'marginLeft'),
      top: -node.offsetTop + parseStyleToInt(boundNodeStyle, 'paddingTop') + parseStyleToInt(nodeStyle, 'marginTop'),
      right: innerWidth(boundNode) - outerWidth(node) - node.offsetLeft +
        parseStyleToInt(boundNodeStyle, 'paddingRight') - parseStyleToInt(nodeStyle, 'marginRight'),
      bottom: innerHeight(boundNode) - outerHeight(node) - node.offsetTop +
        parseStyleToInt(boundNodeStyle, 'paddingBottom') - parseStyleToInt(nodeStyle, 'marginBottom')
    };
  }

  // Clamp x and y to be within the bounds.
  x = Math.max(Math.min(x, bounds.right || 0), bounds.left || 0);
  y = Math.max(Math.min(y, bounds.bottom || 0), bounds.top || 0);

  return [x, y];
};

// Snapping to a grid is super useful for aligning stuff. This function just rounds the position to the nearest grid point.
export const snapToGrid = (grid: [number, number], pendingX: number, pendingY: number): [number, number] => {
  const x = Math.round(pendingX / grid[0]) * grid[0]
  const y = Math.round(pendingY / grid[1]) * grid[1]
  return [x, y]
}

// Can we drag along the x-axis? This checks the draggable's props to see what's allowed.
export const canDragX = (draggable: Partial<DraggableInstance>): boolean => {
  return draggable.props.axis === 'both' || draggable.props.axis === 'x'
}

// Same as canDragX, but for the y-axis. Gotta keep things flexible.
export const canDragY = (draggable: Partial<DraggableInstance>): boolean => {
  return draggable.props.axis === 'both' || draggable.props.axis === 'y'
}

// Getting the control position is a bit of DOM manipulation and event handling.
// It's a bit dense, but it's just calculating positions based on the event and the draggable's state.
export const getControlPosition = (e: MouseTouchEvent, draggableCore: Partial<DraggableCoreInstance>, touchIdentifier?: number | null): ControlPosition | null => {
  const touchObj = typeof touchIdentifier === 'number' ? getTouch(e, touchIdentifier) : null
  if (typeof touchIdentifier === 'number' && !touchObj) return null // not the right touch
  const node: HTMLElement = findDOMNode(draggableCore)
  // User can provide an offsetParent if desired.
  const offsetParent = draggableCore.props.offsetParent || node.offsetParent || node.ownerDocument.body
  return offsetXYFromParent(touchObj || e, offsetParent as HTMLElement, draggableCore.props.scale as number)
}

// When you start dragging, or move the draggable, this function updates the state with the new position.
// It's a bit of a state management thing, keeping track of deltas and positions.
export const createCoreData = (draggable: Partial<DraggableInstance>, x: number, y: number): DraggableData => {
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
export const createDraggableData = (draggable: Partial<DraggableInstance>, coreData: DraggableData): DraggableData => {
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
