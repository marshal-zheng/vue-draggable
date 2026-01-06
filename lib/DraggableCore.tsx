/**
 * DraggableCore is a low-level wrapper for draggable functionality, allowing for more fine-grained control over drag events.
 * It provides the core functionality needed to make an element draggable, such as mouse and touch event handling, without
 * imposing any specific styling or structure on the element being dragged. It's designed to be used as a building block
 * for more complex draggable components.
 *
 * @compatConfig {MODE: 3} - Compatibility mode setting for Vue 3.
 * @name DraggableCore - The name of the component.
 * @inheritAttrs false - Instructs Vue not to add inherited attributes to the component's root element.
 *
 * @props
 * - `allowAnyClick` (Boolean): Allows dragging using any mouse button. Default is `false`, which means only the left mouse button can initiate dragging.
 * - `disabled` (Boolean): Disables the draggable functionality when set to `true`.
 * - `enableUserSelectHack` (Boolean): Enables a hack that prevents user text selection during dragging. Default is `true`.
 * - `startFn` (Function): A function that is called at the start of a drag operation. Default is a no-op function.
 * - `dragFn` (Function): A function that is called during a drag operation. Default is a no-op function.
 * - `stopFn` (Function): A function that is called at the end of a drag operation. Default is a no-op function.
 * - `scale` (Number): The scale of the draggable element, affecting drag sensitivity. Default is `1`.
 * - `cancel` (String): CSS selector that defines elements within the draggable element that should prevent dragging when clicked.
 * - `offsetParent` (HTMLElement): The offset parent of the draggable element, used to calculate drag distances. Must be a DOM Node.
 * - `grid` (Array[Number, Number]): Specifies a grid [x, y] to which the element's movement will be snapped.
 * - `handle` (String): CSS selector that defines the handle element that initiates drag actions. If not defined, the entire element is draggable.
 * - `nodeRef` (Object): A Vue ref object pointing to the draggable element. Used when direct DOM access is necessary.
 * @setup
 * The setup function initializes the component's reactive state and event handlers for drag operations. It handles the
 * initialization and cleanup of event listeners for mouse and touch events that control the drag behavior.
 *
 * @returns
 * The setup function returns a render function that clones the component's default slot's first child, applying the necessary
 * event handlers and a ref to the root element to enable dragging functionality.
 *
 * Note: This component does not render any DOM elements itself; it merely wraps its default slot's content with draggable functionality.
 */
import {
  defineComponent,
  cloneVNode,
  ref,
  onMounted,
  onUnmounted,
  isVNode,
  Comment,
  Text,
  Fragment,
  DefineComponent,
  PropType,
  type VNodeRef
} from 'vue';

import noop from './utils/noop'

import {
  matchesSelectorAndParentsTo,
  addEvent,
  removeEvent,
  addUserSelectStyles,
  getTouch,
  getTouchIdentifier,
  removeUserSelectStyles
} from './utils/domFns';
import { createCoreData, getControlPosition, snapToGrid } from './utils/positionFns';
import log from './utils/log';
import { Axis, EventHandler, MouseTouchEvent, MouseTouchPointerEvent, DraggableData, DraggableCoreDefaultProps, DraggableCoreProps, DraggableEvent } from './utils/types'
import { propIsNotNode } from './utils/shims'

interface IState {
  dragging: boolean
  lastX: number
  lastY: number
  touchIdentifier: number | null
  pointerIdentifier: number | null
  mounted: boolean
}

type AutoScrollContainerInput = HTMLElement | Window | string
type AutoScrollContainerProp = AutoScrollContainerInput | AutoScrollContainerInput[] | null

// Simple abstraction for dragging events names.
const eventsFor = {
  touch: {
    start: 'touchstart',
    move: 'touchmove',
    stop: 'touchend',
    cancel: 'touchcancel'
  },
  mouse: {
    start: 'mousedown',
    move: 'mousemove',
    stop: 'mouseup'
  },
  pointer: {
    start: 'pointerdown',
    move: 'pointermove',
    stop: 'pointerup',
    cancel: 'pointercancel'
  }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const defaultDraggableEventHandler = (e: MouseEvent, data: DraggableData): void | boolean => true

export const draggableCoreDefaultProps: DefineComponent<DraggableCoreDefaultProps>['props'] = {
  /** Allows drag with any mouse button */
  allowAnyClick: {
    type: Boolean,
    default: false,
  },
  /** Disables dragging */
  disabled: {
    type: Boolean,
    default: false,
  },
  /** Allows mobile scrolling (touch events won't prevent default) */
  allowMobileScroll: {
    type: Boolean,
    default: false,
  },
  /** Enables auto-scrolling at edges */
  autoScroll: {
    type: Boolean,
    default: false,
  },
  /** Distance from edge to trigger auto-scroll (pixels) */
  autoScrollThreshold: {
    type: Number,
    default: 30,
  },
  /** Maximum auto-scroll speed */
  autoScrollMaxSpeed: {
    type: Number,
    default: 20,
  },
  /** Auto-scroll direction */
  autoScrollAxis: {
    type: String as PropType<Axis>,
    default: 'both',
  },
  /** Whether auto-scroll includes window */
  autoScrollIncludeWindow: {
    type: Boolean,
    default: true,
  },
  /** Auto-scroll container */
  autoScrollContainer: {
    type: [Object, String, Array] as PropType<AutoScrollContainerProp>,
    default: null,
  },
  /** Disable dragging on interactive elements (input, textarea, etc.) */
  cancelInteractiveElements: {
    type: Boolean,
    default: false,
  },
  /** Suppress click events after dragging */
  enableClickSuppression: {
    type: Boolean,
    default: false,
  },
  /** Click suppression duration (ms) */
  clickSuppressionDuration: {
    type: Number,
    default: 250,
  },
  /** Minimum drag distance to trigger drag (pixels) */
  dragStartThreshold: {
    type: Number,
    default: 0,
  },
  /** Delay before drag starts (ms) */
  dragStartDelay: {
    type: Number,
    default: 0,
  },
  /** Tolerance for movement during drag delay (pixels) */
  dragStartDelayTolerance: {
    type: Number,
    default: 5,
  },
  /** Enable hack to prevent text selection */
  enableUserSelectHack: {
    type: Boolean,
    default: true,
  },
  /** Use requestAnimationFrame for performance optimization */
  useRafDrag: {
    type: Boolean,
    default: false,
  },
  /** Drag start callback. Return false to cancel. */
  startFn: {
    type: Function as PropType<(e: DraggableEvent, data: DraggableData) => void | false>,
    default: noop,
  },
  /** Drag move callback. Return false to cancel. */
  dragFn: {
    type: Function as PropType<(e: DraggableEvent, data: DraggableData) => void | false>,
    default: noop,
  },
  /** Drag stop callback */
  stopFn: {
    type: Function as PropType<(e: DraggableEvent, data: DraggableData) => void | false>,
    default: noop,
  },
  /** Scale factor (for internal scaling) */
  scale: {
    type: Number,
    default: 1,
  }
}

export const draggableCoreProps: DefineComponent<DraggableCoreProps>['props'] = {
  ...draggableCoreDefaultProps,
  /** Selector to prevent dragging */
  cancel: {
    type: String
  },
  /** Offset parent element */
  offsetParent: {
    type: Object as PropType<HTMLElement>,
    validator: (value: unknown): boolean => propIsNotNode(value),
  },
  /** Grid for snapping, e.g. [25, 25] */
  grid: {
    type: Array as PropType<number[]>
  },
  /** Selector for drag handle */
  handle: {
    type: String,
  },
  /** Node reference */
  nodeRef: {
    type: Object as PropType<HTMLElement | null>,
    default: () => null,
  }
}

const componentName = 'DraggableCore'

export default defineComponent({
  compatConfig: { MODE: 3 },
  name: componentName,
  inheritAttrs: false,
  props: {
    ...draggableCoreProps,
  },
  emits: ['mousedown', 'mouseup', 'touchend'],
  setup(props: DraggableCoreProps, { slots, emit }) {
    const rootElement = ref(null)
    // Default to mouse events (instance-scoped, avoids cross-instance interference).
    let dragEventFor = eventsFor.mouse;
    let draggingNode: HTMLElement | null = null;
    let dragRafId: number | null = null;
    let pendingDragEvent: (MouseTouchEvent | PointerEvent) | null = null;
    let lastProcessedX = NaN;
    let lastProcessedY = NaN;
    let pendingDragStart = false;
    let pendingDragStartMode: 'threshold' | 'delay' | null = null;
    let dragStartX = NaN;
    let dragStartY = NaN;
    let pendingX = NaN;
    let pendingY = NaN;
    let dragStartDelayTimerId: number | null = null;
    let dragStartDelayOwnerWindow: Window | null = null;
    let dragStartDelayPassed = false;
    let dragStartDelayEvent: (MouseTouchEvent | PointerEvent) | null = null;
    let hasDragged = false;
    let suppressClickDoc: Document | null = null;
    let suppressClickListener: ((e: MouseEvent) => void) | null = null;
    let suppressClickTimerId: number | null = null;
    let autoScrollRafId: number | null = null;
    let autoScrollContainers: Array<HTMLElement | Window> = [];
    let autoScrollLastEvent: (MouseTouchEvent | PointerEvent) | null = null;
    let pointerCaptureTarget: HTMLElement | null = null;
    let ignoreTouchStartUntil = 0;
    const isElementNode = (v: unknown): v is HTMLElement => {
      return !!v && typeof v === 'object' && 'nodeType' in (v as Record<string, unknown>) && (v as Node).nodeType === 1
    }

    const isRefLike = (v: unknown): v is { value?: unknown } => {
      return !!v && typeof v === 'object' && 'value' in (v as Record<string, unknown>)
    }
    const state: IState = {
      dragging: false,
      // Used while dragging to determine deltas.
      lastX: NaN,
      lastY: NaN,
      touchIdentifier: null,
      pointerIdentifier: null,
      mounted: false
    }


    const findDOMNode = (): HTMLElement | null => {
      if (draggingNode) return draggingNode
      const nodeRef = props.nodeRef as unknown
      if (isRefLike(nodeRef)) {
        const v = nodeRef.value
        if (isElementNode(v)) return v
      } else if (isElementNode(nodeRef)) {
        return nodeRef
      }
      return rootElement.value
    }

    const getOwnerWindow = (): Window => {
      const ownerWindow = draggingNode?.ownerDocument?.defaultView
      return ownerWindow || window
    }

    const getDragStartDelay = (): number => {
      const delay = typeof props.dragStartDelay === 'number' ? props.dragStartDelay : 0
      return delay > 0 ? delay : 0
    }

    const getDragStartThreshold = (): number => {
      const threshold = typeof props.dragStartThreshold === 'number' ? props.dragStartThreshold : 0
      if (threshold <= 0) return 0
      const scale = typeof props.scale === 'number' ? props.scale : 1
      if (!scale) return threshold
      return threshold / scale
    }

    const getDragStartDelayTolerance = (): number => {
      const tolerance = typeof props.dragStartDelayTolerance === 'number' ? props.dragStartDelayTolerance : 0
      if (tolerance <= 0) return 0
      const scale = typeof props.scale === 'number' ? props.scale : 1
      if (!scale) return tolerance
      return tolerance / scale
    }

    const meetsDragStartThreshold = (x: number, y: number): boolean => {
      const threshold = getDragStartThreshold()
      if (threshold <= 0) return true
      if (!Number.isFinite(dragStartX) || !Number.isFinite(dragStartY)) return true
      const dx = x - dragStartX
      const dy = y - dragStartY
      return (dx * dx) + (dy * dy) >= (threshold * threshold)
    }

    const exceedsDragStartDelayTolerance = (x: number, y: number): boolean => {
      const tolerance = getDragStartDelayTolerance()
      if (tolerance <= 0) return false
      if (!Number.isFinite(dragStartX) || !Number.isFinite(dragStartY)) return false
      const dx = x - dragStartX
      const dy = y - dragStartY
      return (dx * dx) + (dy * dy) > (tolerance * tolerance)
    }

    const clearDragStartDelayTimer = () => {
      if (dragStartDelayTimerId == null) return
      const ownerWindow = dragStartDelayOwnerWindow || window
      ownerWindow.clearTimeout?.(dragStartDelayTimerId)
      dragStartDelayTimerId = null
      dragStartDelayOwnerWindow = null
    }

    const clearClickSuppression = () => {
      if (suppressClickTimerId != null) {
        const ownerWindow = suppressClickDoc?.defaultView || window
        ownerWindow.clearTimeout?.(suppressClickTimerId)
        suppressClickTimerId = null
      }
      if (suppressClickDoc && suppressClickListener) {
        suppressClickDoc.removeEventListener('click', suppressClickListener, true)
      }
      suppressClickDoc = null
      suppressClickListener = null
    }

    const installClickSuppression = (doc: Document) => {
      if (!props.enableClickSuppression) return
      const duration: number = typeof props.clickSuppressionDuration === 'number' ? props.clickSuppressionDuration : 0
      if (duration < 0) return
      clearClickSuppression()

      const ownerWindow = doc.defaultView || window
      const suppressUntil = Date.now() + duration
      const handler = (event: MouseEvent) => {
        if (Date.now() > suppressUntil) {
          clearClickSuppression()
          return
        }
        event.preventDefault()
        event.stopPropagation()
          ; (event as unknown as { stopImmediatePropagation?: () => void }).stopImmediatePropagation?.()
        clearClickSuppression()
      }

      suppressClickDoc = doc
      suppressClickListener = handler
      doc.addEventListener('click', handler, true)
      suppressClickTimerId = ownerWindow.setTimeout(() => {
        clearClickSuppression()
      }, duration)
    }

    const getAutoScrollThreshold = (): number => {
      const threshold = typeof props.autoScrollThreshold === 'number' ? props.autoScrollThreshold : 0
      return threshold > 0 ? threshold : 0
    }

    const getAutoScrollMaxSpeed = (): number => {
      const maxSpeed = typeof props.autoScrollMaxSpeed === 'number' ? props.autoScrollMaxSpeed : 0
      return maxSpeed > 0 ? maxSpeed : 0
    }

    const getAutoScrollAxis = (): Axis => {
      const axis = props.autoScrollAxis as unknown
      if (axis === 'x' || axis === 'y' || axis === 'none') return axis
      return 'both'
    }

    const shouldAutoScrollIncludeWindow = (): boolean => {
      return props.autoScrollIncludeWindow !== false
    }

    const isPointerEvent = (e: unknown): e is PointerEvent => {
      return !!e && typeof e === 'object' && 'pointerId' in (e as Record<string, unknown>)
    }

    const shouldUsePointerEventsForTouch = (node: HTMLElement, e: PointerEvent): boolean => {
      if (e.pointerType !== 'touch') return true
      const ownerWindow = node.ownerDocument.defaultView || window
      const style = ownerWindow.getComputedStyle(node)
      const touchAction = style.touchAction || ''
      return touchAction !== '' && touchAction !== 'auto'
    }

    const releasePointerCapture = () => {
      if (!pointerCaptureTarget) return
      const pointerId = state.pointerIdentifier
      if (typeof pointerId !== 'number') {
        pointerCaptureTarget = null
        return
      }
      try {
        if (pointerCaptureTarget.hasPointerCapture?.(pointerId)) {
          pointerCaptureTarget.releasePointerCapture(pointerId)
        } else {
          pointerCaptureTarget.releasePointerCapture?.(pointerId)
        }
      } catch {
        // ignore
      }
      pointerCaptureTarget = null
    }

    const trySetPointerCapture = (node: HTMLElement, pointerId: number) => {
      if (!node.setPointerCapture) return
      try {
        node.setPointerCapture(pointerId)
        pointerCaptureTarget = node
      } catch {
        // ignore
      }
    }

    const getEventClientPosition = (e: MouseTouchPointerEvent): { clientX: number; clientY: number } | null => {
      if (typeof state.pointerIdentifier === 'number') {
        const maybePointerEvent = e as unknown as { pointerId?: unknown; clientX?: unknown; clientY?: unknown }
        if (typeof maybePointerEvent.pointerId !== 'number') return null
        if (maybePointerEvent.pointerId !== state.pointerIdentifier) return null
        if (typeof maybePointerEvent.clientX === 'number' && typeof maybePointerEvent.clientY === 'number') {
          const result: { clientX: number; clientY: number } = {
            clientX: maybePointerEvent.clientX,
            clientY: maybePointerEvent.clientY
          }
          return result
        }
        return null
      }

      if (typeof state.touchIdentifier === 'number') {
        const touch = getTouch(e as MouseTouchEvent, state.touchIdentifier)
        if (touch && typeof touch.clientX === 'number' && typeof touch.clientY === 'number') {
          const result: { clientX: number; clientY: number } = {
            clientX: touch.clientX,
            clientY: touch.clientY
          }
          return result
        }
        return null
      }

      const maybeMouseEvent = e as unknown as { clientX?: unknown; clientY?: unknown }
      if (typeof maybeMouseEvent.clientX === 'number' && typeof maybeMouseEvent.clientY === 'number') {
        const result: { clientX: number; clientY: number } = {
          clientX: maybeMouseEvent.clientX,
          clientY: maybeMouseEvent.clientY
        }
        return result
      }
      return null
    }

    const isScrollableElement = (el: HTMLElement, ownerWindow: Window): boolean => {
      const style = ownerWindow.getComputedStyle(el)
      const overflowY = style.overflowY
      const overflowX = style.overflowX
      const canScrollY = (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && el.scrollHeight > el.clientHeight
      const canScrollX = (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'overlay') && el.scrollWidth > el.clientWidth
      return canScrollX || canScrollY
    }

    const resolveAutoScrollContainerInput = (input: AutoScrollContainerInput, node: HTMLElement): Array<HTMLElement | Window> => {
      const ownerDocument = node.ownerDocument
      const ownerWindow = ownerDocument.defaultView || window

      if (typeof input === 'string') {
        const selector = input.trim()
        if (!selector) return []
        if (selector === 'window') return [ownerWindow]
        if (selector === 'self') return [node]
        if (selector === 'parent') {
          const parent = node.parentElement
          return parent ? [parent] : []
        }
        const el = ownerDocument.querySelector(selector)
        if (el && el instanceof ownerWindow.HTMLElement) return [el]
        return []
      }

      if (input === ownerWindow) return [ownerWindow]
      if (isElementNode(input)) return [input]
      return []
    }

    const getAutoScrollContainers = (node: HTMLElement, includeWindow: boolean): Array<HTMLElement | Window> => {
      const ownerDocument = node.ownerDocument
      const ownerWindow = ownerDocument.defaultView || window
      const containers: Array<HTMLElement | Window> = []

      let el: HTMLElement | null = node.parentElement
      while (el && el !== ownerDocument.body) {
        if (isScrollableElement(el, ownerWindow)) containers.push(el)
        el = el.parentElement
      }

      if (includeWindow) containers.push(ownerWindow)
      return containers
    }

    const getAutoScrollContainersForNode = (node: HTMLElement): Array<HTMLElement | Window> => {
      const includeWindow = shouldAutoScrollIncludeWindow()
      const containerProp = props.autoScrollContainer as AutoScrollContainerProp
      if (containerProp == null) return getAutoScrollContainers(node, includeWindow)

      const inputs = Array.isArray(containerProp) ? containerProp : [containerProp]
      const resolved: Array<HTMLElement | Window> = []
      for (const input of inputs) {
        resolved.push(...resolveAutoScrollContainerInput(input, node))
      }
      if (includeWindow) {
        const ownerWindow = node.ownerDocument.defaultView || window
        resolved.push(ownerWindow)
      }

      const deduped: Array<HTMLElement | Window> = []
      const seen = new Set<HTMLElement | Window>()
      for (const item of resolved) {
        if (seen.has(item)) continue
        seen.add(item)
        deduped.push(item)
      }

      return deduped
    }

    const cancelAutoScrollRaf = () => {
      if (autoScrollRafId == null) return
      const ownerWindow = getOwnerWindow()
      ownerWindow.cancelAnimationFrame?.(autoScrollRafId)
      autoScrollRafId = null
    }

    const scrollElementBy = (el: HTMLElement, dx: number, dy: number): { dx: number; dy: number } => {
      let movedX = 0
      let movedY = 0

      if (dx) {
        const prev = el.scrollLeft
        const max = Math.max(0, el.scrollWidth - el.clientWidth)
        const next = Math.max(0, Math.min(prev + dx, max))
        el.scrollLeft = next
        movedX = next - prev
      }

      if (dy) {
        const prev = el.scrollTop
        const max = Math.max(0, el.scrollHeight - el.clientHeight)
        const next = Math.max(0, Math.min(prev + dy, max))
        el.scrollTop = next
        movedY = next - prev
      }

      return { dx: movedX, dy: movedY }
    }

    const scrollWindowBy = (ownerWindow: Window, dx: number, dy: number): { dx: number; dy: number } => {
      const doc = ownerWindow.document
      const scrollingElement = (doc.scrollingElement || doc.documentElement || doc.body) as HTMLElement | null
      if (!scrollingElement) {
        ownerWindow.scrollBy(dx, dy)
        return { dx, dy }
      }
      return scrollElementBy(scrollingElement, dx, dy)
    }

    const calcAutoScrollSpeed = (distanceToEdge: number, threshold: number, maxSpeed: number): number => {
      if (threshold <= 0 || maxSpeed <= 0) return 0
      if (distanceToEdge >= threshold) return 0
      const clamped = Math.max(0, Math.min(distanceToEdge, threshold))
      const ratio = (threshold - clamped) / threshold
      const speed = Math.ceil(ratio * maxSpeed)
      return speed > 0 ? speed : 0
    }

    const getAutoScrollDeltaForElement = (
      el: HTMLElement,
      clientX: number,
      clientY: number,
      threshold: number,
      maxSpeed: number
    ): { dx: number; dy: number } => {
      const rect = el.getBoundingClientRect()
      const thresholdX = Math.min(threshold, rect.width / 2)
      const thresholdY = Math.min(threshold, rect.height / 2)

      let dx = 0
      let dy = 0

      if (thresholdX > 0) {
        const leftDist = Math.abs(clientX - rect.left)
        const rightDist = Math.abs(rect.right - clientX)
        if (leftDist < thresholdX || rightDist < thresholdX) {
          if (leftDist <= rightDist) dx = -calcAutoScrollSpeed(leftDist, thresholdX, maxSpeed)
          else dx = calcAutoScrollSpeed(rightDist, thresholdX, maxSpeed)
        }
      }

      if (thresholdY > 0) {
        const topDist = Math.abs(clientY - rect.top)
        const bottomDist = Math.abs(rect.bottom - clientY)
        if (topDist < thresholdY || bottomDist < thresholdY) {
          if (topDist <= bottomDist) dy = -calcAutoScrollSpeed(topDist, thresholdY, maxSpeed)
          else dy = calcAutoScrollSpeed(bottomDist, thresholdY, maxSpeed)
        }
      }

      return { dx, dy }
    }

    const getAutoScrollDeltaForWindow = (
      ownerWindow: Window,
      clientX: number,
      clientY: number,
      threshold: number,
      maxSpeed: number
    ): { dx: number; dy: number } => {
      const width = ownerWindow.innerWidth || 0
      const height = ownerWindow.innerHeight || 0
      const thresholdX = Math.min(threshold, width / 2)
      const thresholdY = Math.min(threshold, height / 2)

      let dx = 0
      let dy = 0

      if (thresholdX > 0) {
        const leftDist = Math.abs(clientX)
        const rightDist = Math.abs(width - clientX)
        if (leftDist < thresholdX || rightDist < thresholdX) {
          if (leftDist <= rightDist) dx = -calcAutoScrollSpeed(leftDist, thresholdX, maxSpeed)
          else dx = calcAutoScrollSpeed(rightDist, thresholdX, maxSpeed)
        }
      }

      if (thresholdY > 0) {
        const topDist = Math.abs(clientY)
        const bottomDist = Math.abs(height - clientY)
        if (topDist < thresholdY || bottomDist < thresholdY) {
          if (topDist <= bottomDist) dy = -calcAutoScrollSpeed(topDist, thresholdY, maxSpeed)
          else dy = calcAutoScrollSpeed(bottomDist, thresholdY, maxSpeed)
        }
      }

      return { dx, dy }
    }

    const autoScrollTick = () => {
      autoScrollRafId = null
      if (!props.autoScroll || !state.dragging) return
      if (!autoScrollContainers.length) return

      const threshold = getAutoScrollThreshold()
      const maxSpeed = getAutoScrollMaxSpeed()
      if (!threshold || !maxSpeed) return

      const lastEvent = autoScrollLastEvent || pendingDragEvent
      if (!lastEvent) return
      const pos = getEventClientPosition(lastEvent)
      if (!pos) return

      const posClientX: number = pos.clientX
      const posClientY: number = pos.clientY

      const ownerWindow = getOwnerWindow()
      const axis = getAutoScrollAxis()
      const allowX = axis === 'both' || axis === 'x'
      const allowY = axis === 'both' || axis === 'y'
      if (!allowX && !allowY) return

      let didX = !allowX
      let didY = !allowY
      let didScroll = false

      for (const container of autoScrollContainers) {
        if (didX && didY) break

        const { dx, dy } = container === ownerWindow
          ? getAutoScrollDeltaForWindow(ownerWindow, posClientX, posClientY, threshold, maxSpeed)
          : getAutoScrollDeltaForElement(container as HTMLElement, posClientX, posClientY, threshold, maxSpeed)

        const attemptX = didX ? 0 : dx
        const attemptY = didY ? 0 : dy
        if (!attemptX && !attemptY) continue

        const moved = container === ownerWindow
          ? scrollWindowBy(ownerWindow, attemptX, attemptY)
          : scrollElementBy(container as HTMLElement, attemptX, attemptY)

        if (moved.dx) didX = true
        if (moved.dy) didY = true
        if (moved.dx || moved.dy) didScroll = true
      }

      if (!didScroll) return

      autoScrollLastEvent = lastEvent
      if (props.useRafDrag) {
        cancelDragRaf()
        pendingDragEvent = lastEvent
        flushDragRaf()
      } else {
        handleDrag(lastEvent)
      }

      if (!state.dragging) return
      ensureAutoScrollRaf()
    }

    const ensureAutoScrollRaf = () => {
      if (!props.autoScroll || !state.dragging) return
      if (autoScrollRafId != null) return
      const ownerWindow = getOwnerWindow()
      autoScrollRafId = ownerWindow.requestAnimationFrame(autoScrollTick)
    }

    const cancelPendingDragStart = () => {
      const thisNode = findDOMNode();
      cancelDragRaf();
      clearDragStartDelayTimer();
      cancelAutoScrollRaf();

      state.dragging = false;
      state.lastX = NaN;
      state.lastY = NaN;
      state.touchIdentifier = null;
      releasePointerCapture()
      state.pointerIdentifier = null;
      draggingNode = null;
      pendingDragEvent = null;
      lastProcessedX = NaN;
      lastProcessedY = NaN;
      pendingDragStart = false;
      pendingDragStartMode = null;
      dragStartX = NaN;
      dragStartY = NaN;
      pendingX = NaN;
      pendingY = NaN;
      dragStartDelayPassed = false;
      dragStartDelayEvent = null;
      hasDragged = false;
      autoScrollContainers = [];
      autoScrollLastEvent = null;

      if (thisNode) {
        removeEvent(thisNode.ownerDocument, dragEventFor.move, handleDrag);
        removeEvent(thisNode.ownerDocument, dragEventFor.stop, handleDragStop);
        if ((dragEventFor as unknown as { cancel?: string }).cancel) {
          removeEvent(thisNode.ownerDocument, (dragEventFor as unknown as { cancel: string }).cancel, handleDragStop);
        }
      }
    }

    const startDrag = (e: MouseTouchPointerEvent, x: number, y: number, options?: { resetLastCoords?: boolean }): boolean => {
      const coreEvent = createCoreData({ props, findDOMNode, state: { lastX: NaN, lastY: NaN } }, x, y);
      log('DraggableCore: handleDragStart: %j', coreEvent);

      log('calling', props.startFn);
      const shouldUpdate = props.startFn !== noop ? props.startFn?.(e as DraggableEvent, coreEvent) : undefined;
      if (shouldUpdate === false || state.mounted === false) {
        cancelPendingDragStart();
        return false;
      }

      const thisNode = findDOMNode();
      if (thisNode && props.enableUserSelectHack) addUserSelectStyles(thisNode.ownerDocument);

      if (options?.resetLastCoords) {
        state.lastX = x;
        state.lastY = y;
        lastProcessedX = x;
        lastProcessedY = y;
      }

      pendingDragStart = false;
      pendingDragStartMode = null;
      dragStartDelayPassed = false;
      dragStartDelayEvent = null;
      state.dragging = true;

      autoScrollLastEvent = e
      if (props.autoScroll) {
        const node = findDOMNode()
        autoScrollContainers = node ? getAutoScrollContainersForNode(node) : []
        ensureAutoScrollRaf()
      }
      return true;
    }

    const tryStartDrag = (e: MouseTouchPointerEvent, x: number, y: number): boolean => {
      if (!pendingDragStart) return state.dragging
      if (pendingDragStartMode === 'delay') {
        if (!dragStartDelayPassed) return false
        return startDrag(e, x, y, { resetLastCoords: true })
      }
      if (!meetsDragStartThreshold(x, y)) return false
      return startDrag(e, x, y)
    }

    const cancelDragRaf = () => {
      if (dragRafId == null) return
      const ownerWindow = getOwnerWindow()
      ownerWindow.cancelAnimationFrame?.(dragRafId)
      dragRafId = null
    }

    const scheduleDragRaf = (cb: FrameRequestCallback) => {
      if (dragRafId != null) return
      const ownerWindow = getOwnerWindow()
      dragRafId = ownerWindow.requestAnimationFrame(cb)
    }

    const flushDragRaf = () => {
      dragRafId = null
      if (!state.dragging && !pendingDragStart) return
      const lastEvent = pendingDragEvent
      if (!lastEvent) return
      autoScrollLastEvent = lastEvent

      const position = getControlPosition(lastEvent, { props, findDOMNode }, state.touchIdentifier);
      if (position == null) return;
      let { x, y } = position;

      const baseX = Number.isFinite(lastProcessedX) ? lastProcessedX : state.lastX
      const baseY = Number.isFinite(lastProcessedY) ? lastProcessedY : state.lastY

      if (!state.dragging) {
        if (pendingDragStartMode === 'delay') {
          pendingX = x
          pendingY = y
          if (!dragStartDelayPassed) {
            if (exceedsDragStartDelayTolerance(x, y)) cancelPendingDragStart()
            return
          }
        }
        const started = tryStartDrag(lastEvent, x, y)
        if (!started) return
      }

      // Skip useless drag (no movement).
      if (x === baseX && y === baseY) return;

      // Snap to grid if prop has been provided
      if (Array.isArray(props.grid)) {
        let deltaX = x - baseX, deltaY = y - baseY;
        [deltaX, deltaY] = snapToGrid(props.grid as [number, number], deltaX, deltaY);
        if (!deltaX && !deltaY) return; // skip useless drag
        x = baseX + deltaX, y = baseY + deltaY;
      }

      lastProcessedX = x
      lastProcessedY = y

      const coreEvent = createCoreData({ props, findDOMNode, state }, x, y);

      log('DraggableCore: handleDrag: %j', coreEvent);

      // Call event handler. If it returns explicit false, trigger end.
      const shouldUpdate = props.dragFn !== noop ? props.dragFn?.(lastEvent as DraggableEvent, coreEvent) : undefined;
      if (shouldUpdate === false || state.mounted === false) {
        handleDragStop(lastEvent);
        return;
      }

      state.lastX = x;
      state.lastY = y;
      hasDragged = true;
      ensureAutoScrollRaf();
    }

    const flushPendingDragRaf = () => {
      if (dragRafId == null) return
      cancelDragRaf()
      flushDragRaf()
    }

    const handleDrag: EventHandler<MouseTouchPointerEvent> = e => {
      if (typeof state.pointerIdentifier === 'number') {
        if (!isPointerEvent(e)) return
        if (e.pointerId !== state.pointerIdentifier) return
      }

      autoScrollLastEvent = e
      if (props.useRafDrag) {
        const isTouchLike = dragEventFor === eventsFor.touch || (dragEventFor === eventsFor.pointer && isPointerEvent(e) && e.pointerType === 'touch')
        if (isTouchLike) {
          const position = getControlPosition(e, { props, findDOMNode }, state.touchIdentifier);
          if (position == null) return;
          const { x, y } = position;

          if (!state.dragging) {
            if (pendingDragStartMode === 'delay') {
              pendingX = x
              pendingY = y
              if (!dragStartDelayPassed) {
                if (exceedsDragStartDelayTolerance(x, y)) cancelPendingDragStart()
                return
              }
            }
            const started = tryStartDrag(e, x, y)
            if (!started) return
          }

          if (!props.allowMobileScroll && e.cancelable !== false) e.preventDefault()
        }

        pendingDragEvent = e
        scheduleDragRaf(flushDragRaf)
        ensureAutoScrollRaf();
        return
      }
      // Get the current drag point from the event. This is used as the offset.
      const position = getControlPosition(e, { props, findDOMNode }, state.touchIdentifier);
      if (position == null) return;
      let { x, y } = position;

      if (!state.dragging) {
        if (pendingDragStartMode === 'delay') {
          pendingX = x
          pendingY = y
          if (!dragStartDelayPassed) {
            if (exceedsDragStartDelayTolerance(x, y)) cancelPendingDragStart()
            return
          }
        }
        const started = tryStartDrag(e, x, y)
        if (!started) return
      }
      const isTouchLike = dragEventFor === eventsFor.touch || (dragEventFor === eventsFor.pointer && isPointerEvent(e) && e.pointerType === 'touch')
      if (isTouchLike && !props.allowMobileScroll && e.cancelable !== false) {
        e.preventDefault()
      }

      // Skip useless drag (no movement).
      if (x === state.lastX && y === state.lastY) return;

      // Snap to grid if prop has been provided
      if (Array.isArray(props.grid)) {
        let deltaX = x - state.lastX, deltaY = y - state.lastY;
        [deltaX, deltaY] = snapToGrid(props.grid as [number, number], deltaX, deltaY);
        if (!deltaX && !deltaY) return; // skip useless drag
        x = state.lastX + deltaX, y = state.lastY + deltaY;
      }

      const coreEvent = createCoreData({ props, findDOMNode, state }, x, y);

      log('DraggableCore: handleDrag: %j', coreEvent);

      // Call event handler. If it returns explicit false, trigger end.
      const shouldUpdate = props.dragFn !== noop ? props.dragFn?.(e as DraggableEvent, coreEvent) : undefined;
      if (shouldUpdate === false || state.mounted === false) {
        handleDragStop(e);
        return;
      }

      state.lastX = x;
      state.lastY = y;
      hasDragged = true;
      ensureAutoScrollRaf();
    };

    const handleDragStop: EventHandler<MouseTouchPointerEvent> = e => {
      if (!state.dragging && !pendingDragStart) return;
      if (typeof state.pointerIdentifier === 'number' && isPointerEvent(e) && e.pointerId !== state.pointerIdentifier) {
        return
      }

      if (props.useRafDrag) {
        flushPendingDragRaf()
      }

      cancelAutoScrollRaf();
      autoScrollContainers = [];
      autoScrollLastEvent = null;

      const thisNode = findDOMNode();
      if (state.dragging) {
        const position = getControlPosition(e, { props, findDOMNode }, state.touchIdentifier);
        if (position == null) return;
        let { x, y } = position;

        // Snap to grid if prop has been provided
        if (Array.isArray(props.grid)) {
          let deltaX = x - state.lastX || 0;
          let deltaY = y - state.lastY || 0;
          [deltaX, deltaY] = snapToGrid(props.grid as [number, number], deltaX, deltaY);
          x = state.lastX + deltaX, y = state.lastY + deltaY;
        }

        const coreEvent = createCoreData({ props, findDOMNode, state }, x, y);

        // Call event handler
        const shouldContinue = props.stopFn !== noop ? props.stopFn?.(e as DraggableEvent, coreEvent) : undefined;
        if (shouldContinue === false || state.mounted === false) return false;

        if (thisNode) {
          // Remove user-select hack
          if (props.enableUserSelectHack) removeUserSelectStyles(thisNode.ownerDocument);
        }

        log('DraggableCore: handleDragStop: %j', coreEvent);
      }

      if (thisNode && state.dragging && hasDragged) {
        installClickSuppression(thisNode.ownerDocument)
      }

      // Reset the el.
      state.dragging = false;
      state.lastX = NaN;
      state.lastY = NaN;
      state.touchIdentifier = null;
      releasePointerCapture()
      state.pointerIdentifier = null;
      draggingNode = null;
      pendingDragEvent = null;
      lastProcessedX = NaN;
      lastProcessedY = NaN;
      pendingDragStart = false;
      pendingDragStartMode = null;
      dragStartX = NaN;
      dragStartY = NaN;
      pendingX = NaN;
      pendingY = NaN;
      dragStartDelayPassed = false;
      dragStartDelayEvent = null;
      clearDragStartDelayTimer();
      hasDragged = false;

      if (thisNode) {
        // Remove event handlers
        log('DraggableCore: Removing handlers');
        removeEvent(thisNode.ownerDocument, dragEventFor.move, handleDrag);
        removeEvent(thisNode.ownerDocument, dragEventFor.stop, handleDragStop);
        if ((dragEventFor as unknown as { cancel?: string }).cancel) {
          removeEvent(thisNode.ownerDocument, (dragEventFor as unknown as { cancel: string }).cancel, handleDragStop);
        }
      }
    };

    const handleDragStart: EventHandler<MouseTouchPointerEvent> = e => {
      // Make it possible to attach event handlers on top of this one.
      emit('mousedown', e)

      // Only accept left-clicks.
      if (
        !props.allowAnyClick
        && typeof e.button === 'number'
        && e.button !== 0
      ) return false;

      // Get nodes. Be sure to grab relative document (could be iframed)
      const thisNode = findDOMNode() as HTMLElement;
      if (!thisNode?.ownerDocument?.body) {
        // throw new Error('<DraggableCore> not mounted on DragStart!');
      }
      const { ownerDocument } = thisNode;

      // Short circuit if handle or cancel prop was provided and selector doesn't match.
      if (
        props.disabled
        || (ownerDocument && (!(e.target instanceof ownerDocument.defaultView!.Node)))
        || (props.handle && !matchesSelectorAndParentsTo(e.target as Node, props.handle, thisNode))
        || (props.cancel && matchesSelectorAndParentsTo(e.target as Node, props.cancel, thisNode))) {
        return;
      }

      if (
        props.cancelInteractiveElements
        && matchesSelectorAndParentsTo(
          e.target as Node,
          'input,textarea,button,select,option,a,[contenteditable]:not([contenteditable="false"])',
          thisNode
        )
      ) {
        return;
      }

      // Track which pointer/touch is active so multi-touch / multi-pointer doesn't interfere.
      const pointerEvent = isPointerEvent(e) ? e : null
      state.pointerIdentifier = pointerEvent ? pointerEvent.pointerId : null
      const touchIdentifier = state.pointerIdentifier == null ? getTouchIdentifier(e as MouseTouchEvent) : null
      state.touchIdentifier = touchIdentifier
      // Get the current drag point from the event. This is used as the offset.
      const position = getControlPosition(e, { props, findDOMNode }, touchIdentifier);
      if (position == null) return;
      const { x, y } = position;

      // Create an event object with all the data parents need to make a decision here.
      draggingNode = thisNode;
      pendingDragEvent = null;
      state.lastX = x;
      state.lastY = y;
      lastProcessedX = x;
      lastProcessedY = y;
      cancelDragRaf();
      clearDragStartDelayTimer();
      clearClickSuppression();
      dragStartDelayPassed = false;
      dragStartDelayEvent = null;
      hasDragged = false;

      dragStartX = x;
      dragStartY = y;
      pendingX = x;
      pendingY = y;

      const shouldDelay = (e.type === 'touchstart' || pointerEvent?.pointerType === 'touch') && getDragStartDelay() > 0
      pendingDragStart = shouldDelay || getDragStartThreshold() > 0;
      pendingDragStartMode = shouldDelay ? 'delay' : (pendingDragStart ? 'threshold' : null);

      if (pendingDragStartMode === 'delay') {
        const delay = getDragStartDelay()
        dragStartDelayEvent = e
        const ownerWindow = ownerDocument.defaultView || window
        dragStartDelayOwnerWindow = ownerWindow
        dragStartDelayTimerId = ownerWindow.setTimeout(() => {
          dragStartDelayTimerId = null
          dragStartDelayOwnerWindow = null
          dragStartDelayPassed = true
          if (!pendingDragStart || pendingDragStartMode !== 'delay' || state.dragging || state.mounted === false) return
          const nextX = Number.isFinite(pendingX) ? pendingX : dragStartX
          const nextY = Number.isFinite(pendingY) ? pendingY : dragStartY
          startDrag(dragStartDelayEvent || e, nextX, nextY, { resetLastCoords: true })
        }, delay)
      } else if (!pendingDragStart) {
        const started = startDrag(e, x, y)
        if (started === false) return false
      }

      // Add events to the document directly so we catch when the user's mouse/touch moves outside of
      // this element. We use different events depending on whether or not we have detected that this
      // is a touch-capable device.
      const isTouchLike = dragEventFor === eventsFor.touch || (dragEventFor === eventsFor.pointer && pointerEvent?.pointerType === 'touch')
      const touchListenerOptions = isTouchLike ? { passive: false } : undefined
      addEvent(ownerDocument, dragEventFor.move, handleDrag, touchListenerOptions);
      addEvent(ownerDocument, dragEventFor.stop, handleDragStop, touchListenerOptions);
      if ((dragEventFor as unknown as { cancel?: string }).cancel) {
        addEvent(ownerDocument, (dragEventFor as unknown as { cancel: string }).cancel, handleDragStop, touchListenerOptions);
      }

      if (dragEventFor === eventsFor.pointer && pointerEvent) {
        trySetPointerCapture(thisNode, pointerEvent.pointerId)
      }
    };

    const onPointerdown: EventHandler<MouseTouchPointerEvent> = e => {
      if (!isPointerEvent(e)) return
      const thisNode = findDOMNode()
      if (!thisNode) return

      if (!shouldUsePointerEventsForTouch(thisNode, e)) return
      if (e.pointerType === 'touch') ignoreTouchStartUntil = Date.now() + 100

      dragEventFor = eventsFor.pointer
      return handleDragStart(e)
    }

    const onMousedown: EventHandler<MouseTouchPointerEvent> = e => {
      const ownerWindow = getOwnerWindow()
      if (typeof (ownerWindow as unknown as { PointerEvent?: unknown }).PointerEvent !== 'undefined') return
      dragEventFor = eventsFor.mouse; // on touchscreen laptops we could switch back to mouse
      return handleDragStart(e);
    };

    const onMouseup: EventHandler<MouseTouchPointerEvent> = e => {
      const ownerWindow = getOwnerWindow()
      if (typeof (ownerWindow as unknown as { PointerEvent?: unknown }).PointerEvent !== 'undefined') return
      dragEventFor = eventsFor.mouse;

      return handleDragStop(e);
    };

    const onTouchStart: EventHandler<MouseTouchPointerEvent> = e => {
      if (ignoreTouchStartUntil && Date.now() < ignoreTouchStartUntil) {
        ignoreTouchStartUntil = 0
        return
      }
      // We're on a touch device now, so change the event handlers
      dragEventFor = eventsFor.touch;

      return handleDragStart(e);
    };

    const onTouchend: EventHandler<MouseTouchPointerEvent> = e => {
      // We're on a touch device now, so change the event handlers
      dragEventFor = eventsFor.touch;

      return handleDragStop(e);
    };

    onMounted(() => {
      state.mounted = true
      const thisNode = findDOMNode()
      if (thisNode) {
        addEvent(thisNode, eventsFor.touch.start, onTouchStart, { passive: false });
      }
    });

    onUnmounted(() => {
      state.mounted = false;
      draggingNode = null;
      cancelDragRaf()
      clearDragStartDelayTimer()
      clearClickSuppression()
      cancelAutoScrollRaf()
      releasePointerCapture()
      state.pointerIdentifier = null
      state.touchIdentifier = null
      autoScrollContainers = []
      autoScrollLastEvent = null
      // Remove any leftover event handlers. Remove both touch and mouse handlers in case
      // some browser quirk caused a touch event to fire during a mouse move, or vice versa.
      const thisNode = findDOMNode();
      if (thisNode) {
        const { ownerDocument } = thisNode;
        removeEvent(ownerDocument, eventsFor.mouse.move, handleDrag);
        removeEvent(ownerDocument, eventsFor.touch.move, handleDrag);
        removeEvent(ownerDocument, eventsFor.pointer.move, handleDrag);
        removeEvent(ownerDocument, eventsFor.mouse.stop, handleDragStop);
        removeEvent(ownerDocument, eventsFor.touch.stop, handleDragStop);
        removeEvent(ownerDocument, eventsFor.touch.cancel, handleDragStop);
        removeEvent(ownerDocument, eventsFor.pointer.stop, handleDragStop);
        removeEvent(ownerDocument, eventsFor.pointer.cancel, handleDragStop);
        removeEvent(thisNode, eventsFor.touch.start, onTouchStart, { passive: false });
        if (props.enableUserSelectHack) removeUserSelectStyles(ownerDocument);
      }
    });

    const getFirstUsableChild = () => {
      const raw = slots.default ? slots.default() : []
      const stack: unknown[] = Array.isArray(raw) ? [...raw] : [raw]
      while (stack.length) {
        const item = stack.shift()
        if (Array.isArray(item)) {
          for (let i = item.length - 1; i >= 0; i -= 1) stack.unshift(item[i])
          continue
        }
        if (!isVNode(item)) continue

        if (item.type === Comment) continue
        if (item.type === Text) {
          const txt = typeof item.children === 'string' ? item.children : ''
          if (!txt || !txt.trim()) continue
          continue
        }
        if (item.type === Fragment) {
          const fragChildren = item.children
          if (Array.isArray(fragChildren)) {
            for (let i = fragChildren.length - 1; i >= 0; i -= 1) stack.unshift(fragChildren[i])
          }
          continue
        }

        return item
      }
      return null
    }

    return () => {
      const child = getFirstUsableChild();
      if (!child) return null;
      // const clonedChildren = isVNode(child) ? cloneVNode(child, { onMousedown, onMouseup, onTouchend, ref: props.nodeRef || rootElement }) : child;
      const safeRef = props.nodeRef as unknown
      const vnodeRef: VNodeRef = isRefLike(safeRef) ? (safeRef as unknown as VNodeRef) : rootElement
      const clonedChildren = isVNode(child) ? cloneVNode(child, { onPointerdown, onMousedown, onMouseup, onTouchend, ref: vnodeRef }) : child;
      // const clonedChildren = isVNode(child) ? cloneVNode(child, {}) : child;

      return clonedChildren;
    };
  }
})
