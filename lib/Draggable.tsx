/**
 * Draggable is a Vue component that allows elements to be dragged and dropped.
 * It extends DraggableCore by adding Vue-specific props for more customized behavior.
 * 
 * Props:
 * - axis: Specifies the axis along which the element can be dragged. Options are 'both', 'x', 'y', or 'none'. Default is 'both'.
 * - bounds: Constrains the draggable area. Can be an object specifying left, right, top, and bottom bounds, a string selector, or false for no bounds. Default is false.
 * - defaultClassName: The default class name applied to the element. Default is 'vue-draggable'.
 * - defaultClassNameDragging: The class name applied to the element while dragging. Default is 'vue-draggable-dragging'.
 * - defaultClassNameDragged: The class name applied to the element after it has been dragged. Default is 'vue-draggable-dragged'.
 * - defaultPosition: The default position of the element. An object with x and y properties. Default is {x: 0, y: 0}.
 * - positionOffset: Offset of the position. An object with x and y properties, each can be a number or a string. Default is {x: 0, y: 0}.
 * - position: Controls the position of the draggable element. An object with x and y properties.
 * - cancel: Specifies a selector to be used to prevent drag initialization.
 * - offsetParent: Specifies the offset parent of the draggable element. Must be a DOM Node.
 * - grid: Specifies the grid to snap the draggable element to during drag. An array of two numbers.
 * - handle: Specifies a selector to be used as the handle that initiates drag.
 * - nodeRef: A reference to the draggable node.
 * - allowAnyClick: Allows dragging to be initiated with any mouse button. Default is false.
 * - disabled: If true, the element cannot be dragged. Default is false.
 * - enableUserSelectHack: Enables a hack that prevents text selection during drag. Default is true.
 * - startFn, dragFn, stopFn: Functions that are called on drag start, during drag, and on drag stop, respectively. Each defaults to a no-op function.
 * - scale: The scale of the draggable element. Default is 1.
 * 
 * Usage:
 * Wrap a single child component or element with <Draggable> to make it draggable. Configure behavior with props.
 * 
 * Example:
 * <Draggable axis="x" :defaultPosition="{x: 100, y: 0}">
 *   <div>Drag me!</div>
 * </Draggable>
 * 
 * Note:
 * This component requires Vue 3 and is designed to work within a Vue 3 application.
 */
import {
  defineComponent,
  reactive,
  onMounted,
  onUnmounted,
  ref,
  cloneVNode,
  isVNode,
  Comment,
  Text,
  Fragment,
  PropType,
  DefineComponent
} from 'vue'
import clsx from 'clsx';
import {createCSSTransform, createSVGTransform} from './utils/domFns';
import {canDragX, canDragY, getBoundPosition} from './utils/positionFns';
import {dontSetMe} from './utils/shims';
import DraggableCore from './DraggableCore';
import log from './utils/log';
import noop from './utils/noop';
import type { DraggableEventHandler, PositionOffsetControlPosition, DraggableBounds, ControlPosition, Axis, DraggableProps } from './utils/types';
import { draggableCoreProps } from './DraggableCore';

export const draggableProps = {
  ...draggableCoreProps,
  axis: {
    type: String as PropType<Axis>,
    default: 'both',
  },
  directionLock: {
    type: Boolean,
    default: false,
  },
  directionLockThreshold: {
    type: Number,
    default: 4,
  },
  bounds: {
    type: [Object, String, Boolean] as PropType<DraggableBounds>,
    default: false,
  },
  defaultClassName: {
    type: String,
    default: 'vue-draggable',
  },
  defaultClassNameDragging: {
    type: String,
    default: 'vue-draggable-dragging',
  },
  defaultClassNameDragged: {
    type: String,
    default: 'vue-draggable-dragged',
  },
  defaultPosition: {
    type: Object as PropType<ControlPosition>,
    default: () => ({ x: 0, y: 0 }),
  },
  positionOffset: {
    type: Object as PropType<PositionOffsetControlPosition>,
  },
  position: {
    type: Object as PropType<ControlPosition>,
    default: undefined
  }
}

const componentName = 'Draggable'

const Draggable = defineComponent({
  compatConfig: { MODE: 3 },
  name: componentName,
  inheritAttrs: false,
  props: {
    ...draggableProps,
    style: dontSetMe('style', componentName),
    class: dontSetMe('class', componentName),
    transform: dontSetMe('transform', componentName),
  },
  setup(props: DefineComponent<DraggableProps>['props'], { slots }){
    const localNodeRef = ref<HTMLElement | null>(null)
    const state = reactive<{
      dragging: boolean
      dragged: boolean
      x: number
      y: number
      slackX: number
      slackY: number
      isElementSVG: boolean
    }>({
      // Whether or not we are currently dragging.
      dragging: false,
      // Whether or not we have been dragged before.
      dragged: false,
      // Current transform x and y.
      x: (props.position?.x ?? props.defaultPosition.x) ?? 0,
      y: (props.position?.y ?? props.defaultPosition.y) ?? 0,
      // Used for compensating for out-of-bounds drags
      slackX: 0, slackY: 0,

      // Can only determine if SVG after mounting
      isElementSVG: false
    })

    const isElementNode = (v: unknown): v is HTMLElement => {
      return !!v && typeof v === 'object' && 'nodeType' in (v as Record<string, unknown>) && (v as Node).nodeType === 1
    }

    const isRefLike = (v: unknown): v is { value?: unknown } => {
      return !!v && typeof v === 'object' && 'value' in (v as Record<string, unknown>)
    }

    const findDOMNode = (): HTMLElement | null => {
      const nodeRef = props.nodeRef as unknown
      if (isRefLike(nodeRef)) {
        const v = nodeRef.value
        if (isElementNode(v)) return v
      } else if (isElementNode(nodeRef)) {
        return nodeRef
      }
      return localNodeRef.value
    }

    const boundsContext: {
      props: DefineComponent<DraggableProps>['props']
      findDOMNode: () => HTMLElement | null
      __boundsCache: {
        key: string
        node: HTMLElement | null
        boundEl: HTMLElement | null
        boundClientWidth: number
        boundClientHeight: number
        nodeClientWidth: number
        nodeClientHeight: number
        bounds: DraggableBounds | null
      }
    } = {
      props,
      findDOMNode,
      __boundsCache: {
        key: '',
        node: null,
        boundEl: null,
        boundClientWidth: 0,
        boundClientHeight: 0,
        nodeClientWidth: 0,
        nodeClientHeight: 0,
        bounds: null
      }
    }

    let rafId: number | null = null
    let internalX = state.x
    let internalY = state.y
    let internalSlackX = state.slackX
    let internalSlackY = state.slackY
    let directionLockAxis: 'x' | 'y' | null = null
    let directionLockFixedX = NaN
    let directionLockFixedY = NaN
    let directionLockTotalX = 0
    let directionLockTotalY = 0

    const resetDirectionLock = () => {
      directionLockAxis = null
      directionLockFixedX = NaN
      directionLockFixedY = NaN
      directionLockTotalX = 0
      directionLockTotalY = 0
    }

    const getDirectionLockThreshold = (): number => {
      const threshold = typeof props.directionLockThreshold === 'number' ? props.directionLockThreshold : 0
      if (threshold <= 0) return 0
      const scale = typeof props.scale === 'number' ? props.scale : 1
      if (!scale) return threshold
      return threshold / scale
    }

    const flushToReactiveState = () => {
      rafId = null
      if (
        internalX === state.x &&
        internalY === state.y &&
        internalSlackX === state.slackX &&
        internalSlackY === state.slackY
      ) return
      state.x = internalX
      state.y = internalY
      state.slackX = internalSlackX
      state.slackY = internalSlackY
    }

    const scheduleFlush = () => {
      if (rafId != null) return
      rafId = window.requestAnimationFrame(flushToReactiveState)
    }

    onMounted(() => {
      if(typeof window.SVGElement !== 'undefined' && findDOMNode() instanceof window.SVGElement) {
        state.isElementSVG = true
      }
    })

    onUnmounted(() => {
      state.dragging = false
      if (rafId != null) {
        window.cancelAnimationFrame(rafId)
        rafId = null
      }
    })
  
    const onDragStart: DraggableEventHandler = (e, coreData) => {
      log('Draggable: onDragStart: %j', coreData);
  
      // Short-circuit if user's callback killed it.
      const isControlled = Boolean(props.position)
      if (isControlled) {
        internalX = props.position.x
        internalY = props.position.y
      } else {
        internalX = state.x
        internalY = state.y
      }
      internalSlackX = state.slackX
      internalSlackY = state.slackY
      boundsContext.__boundsCache.key = ''
      boundsContext.__boundsCache.node = null
      boundsContext.__boundsCache.boundEl = null
      boundsContext.__boundsCache.boundClientWidth = 0
      boundsContext.__boundsCache.boundClientHeight = 0
      boundsContext.__boundsCache.nodeClientWidth = 0
      boundsContext.__boundsCache.nodeClientHeight = 0
      boundsContext.__boundsCache.bounds = null

      resetDirectionLock()
      flushToReactiveState()

      if (props.startFn !== noop) {
        const scale = typeof props.scale === 'number' ? props.scale : 1
        const uiStart = {
          node: coreData.node,
          x: internalX + (coreData.deltaX / scale),
          y: internalY + (coreData.deltaY / scale),
          deltaX: (coreData.deltaX / scale),
          deltaY: (coreData.deltaY / scale),
          lastX: internalX,
          lastY: internalY
        }
        const shouldStart = props.startFn?.(e, uiStart);
        // Kills start event on core as well, so move handlers are never bound.
        if (shouldStart === false) return false;
      }

      state.dragging = true
      state.dragged = true
    };

    const onDrag: DraggableEventHandler = (e, coreData) => {
      if (!state.dragging) return false;
      log('Draggable: dragFn: %j', coreData);
  
      const scale = typeof props.scale === 'number' ? props.scale : 1
      const rawDeltaX = (coreData.deltaX / scale)
      const rawDeltaY = (coreData.deltaY / scale)
      let newX = internalX + rawDeltaX
      let newY = internalY + rawDeltaY
      let newSlackX = 0;
      let newSlackY = 0;
      let uiDeltaX = rawDeltaX
      let uiDeltaY = rawDeltaY

      const allowAxisX = canDragX({ props })
      const allowAxisY = canDragY({ props })
      let effectiveAxisX = allowAxisX
      let effectiveAxisY = allowAxisY

      if (props.directionLock && allowAxisX && allowAxisY) {
        if (directionLockAxis == null) {
          directionLockTotalX += rawDeltaX
          directionLockTotalY += rawDeltaY
          const threshold = getDirectionLockThreshold()
          if (!threshold || Math.hypot(directionLockTotalX, directionLockTotalY) >= threshold) {
            directionLockAxis = Math.abs(directionLockTotalX) >= Math.abs(directionLockTotalY) ? 'x' : 'y'
            directionLockFixedX = internalX
            directionLockFixedY = internalY
          }
        }
        if (directionLockAxis === 'x' && Number.isFinite(directionLockFixedY)) {
          newY = directionLockFixedY
          uiDeltaY = newY - internalY
        } else if (directionLockAxis === 'y' && Number.isFinite(directionLockFixedX)) {
          newX = directionLockFixedX
          uiDeltaX = newX - internalX
        }
      }

      if (directionLockAxis === 'x') effectiveAxisY = false
      if (directionLockAxis === 'y') effectiveAxisX = false

      if (!effectiveAxisX) {
        newX = internalX
        uiDeltaX = 0
      }
      if (!effectiveAxisY) {
        newY = internalY
        uiDeltaY = 0
      }
  
      // Keep within bounds.
      if (props.bounds) {
        // Save original x and y.
        const x = newX;
        const y = newY;
  
        // Add slack to the values used to calculate bound position. This will ensure that if
        // completely removed.
        const slackX = effectiveAxisX ? internalSlackX : 0
        const slackY = effectiveAxisY ? internalSlackY : 0
        newX += slackX;
        newY += slackY;
  
        // Get bound position. This will ceil/floor the x and y within the boundaries.
        const [boundX, boundY] = getBoundPosition(boundsContext, newX, newY);
        newX = boundX;
        newY = boundY;
  
        // Recalculate slack by noting how much was shaved by the boundPosition handler.
        newSlackX = slackX + (x - newX);
        newSlackY = slackY + (y - newY);
  
        // Update the event we fire to reflect what really happened after bounds took effect.
        uiDeltaX = newX - internalX;
        uiDeltaY = newY - internalY;
      }

      if (!effectiveAxisX) newSlackX = 0
      if (!effectiveAxisY) newSlackY = 0
  
      // Short-circuit if user's callback killed it.
      if (props.dragFn !== noop) {
        const uiData = {
          node: coreData.node,
          x: newX,
          y: newY,
          deltaX: uiDeltaX,
          deltaY: uiDeltaY,
          lastX: internalX,
          lastY: internalY
        }
        const shouldUpdate = props.dragFn?.(e, uiData);
        if (shouldUpdate === false) return false;
      }

      internalX = newX
      internalY = newY
      internalSlackX = newSlackX
      internalSlackY = newSlackY
      if (props.useRafDrag) {
        if (rafId != null) {
          window.cancelAnimationFrame(rafId)
          rafId = null
        }
        flushToReactiveState()
      } else {
        scheduleFlush()
      }
    };

    const onDragStop: DraggableEventHandler = (e, coreData) => {
      if (!state.dragging) return false;
  
      // Short-circuit if user's callback killed it.
      if (props.stopFn !== noop) {
        const scale = typeof props.scale === 'number' ? props.scale : 1
        const allowAxisX = canDragX({ props })
        const allowAxisY = canDragY({ props })
        const effectiveAxisX = allowAxisX && directionLockAxis !== 'y'
        const effectiveAxisY = allowAxisY && directionLockAxis !== 'x'
        const deltaX = effectiveAxisX ? (coreData.deltaX / scale) : 0
        const deltaY = effectiveAxisY ? (coreData.deltaY / scale) : 0
        const uiStop = {
          node: coreData.node,
          x: internalX + deltaX,
          y: internalY + deltaY,
          deltaX,
          deltaY,
          lastX: internalX,
          lastY: internalY
        }
        const shouldContinue = props.stopFn?.(e, uiStop);
        if (shouldContinue === false) return false;
      }
  
      log('Draggable: onDragStop: %j', coreData);
  
      resetDirectionLock()
      const newState: {
        dragging: boolean,
        slackX: number,
        slackY: number,
        x?: number,
        y?: number 
      } = {
        dragging: false,
        slackX: 0,
        slackY: 0,
      };
  
      // If this is a controlled component, the result of this operation will be to
      // revert back to the old position. We expect a handler on `onDragStop`, at the least.
      const controlled = Boolean(props.position);
      if (controlled) {
        const { x, y } = props.position;
        newState.x = x;
        newState.y = y;
      }

      state.dragging = newState.dragging;
      internalSlackX = newState.slackX
      internalSlackY = newState.slackY
      if (typeof newState.x === 'number') internalX = newState.x
      if (typeof newState.y === 'number') internalY = newState.y

      if (rafId != null) {
        window.cancelAnimationFrame(rafId)
        rafId = null
      }
      flushToReactiveState()
    };

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

        // Skip comment nodes and whitespace-only text nodes.
        if (item.type === Comment) continue
        if (item.type === Text) {
          const txt = typeof item.children === 'string' ? item.children : ''
          if (!txt || !txt.trim()) continue
          // Draggable requires an element/component vnode, not bare text.
          continue
        }

        // Unwrap fragments to find the first real node.
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
      /* eslint-disable @typescript-eslint/no-unused-vars */
      const {
        axis,
        directionLock,
        directionLockThreshold,
        bounds,
        defaultPosition,
        defaultClassName,
        defaultClassNameDragging,
        defaultClassNameDragged,
        position,
        positionOffset,
        scale,
        ...draggableCoreProps
      } = props;
      /* eslint-enable @typescript-eslint/no-unused-vars */

      let style: unknown = {};
      let svgTransform = '';

      const controlled = Boolean(position);
      const draggable = !controlled || state.dragging;

      const validPosition = position || defaultPosition;

      const transformOpts = {
        // Set left if horizontal drag is enabled
        x: (canDragX({ props }) && draggable ?
        state.x :
        validPosition.x) ?? 0,
  
        // Set top if vertical drag is enabled
        y: (canDragY({ props }) && draggable ?
        state.y :
        validPosition.y) ?? 0
      };

      // If this element was SVG, we use the `transform` attribute.
      if (state.isElementSVG) {
        svgTransform = createSVGTransform(transformOpts, positionOffset as PositionOffsetControlPosition);
      } else {
        // Add a CSS transform to move the element around. This allows us to move the element around
        // without worrying about whether or not it is relatively or absolutely positioned.
        // If the item you are dragging already has a transform set, wrap it in a <span> so <Draggable>
        // has a clean slate.
        style = createCSSTransform(transformOpts, positionOffset as PositionOffsetControlPosition);
      }

      // Mark with class while dragging
      const className = clsx((defaultClassName as string), {
        [defaultClassNameDragging]: state.dragging,
        [defaultClassNameDragged]: state.dragged
      });

      const child = getFirstUsableChild();
      if (!child) return null;
      const clonedChildren = cloneVNode(child, {
        class: className,
        style,
        transform: svgTransform
      });


      const coreProps = { ...draggableCoreProps, startFn: onDragStart, dragFn: onDrag, stopFn: onDragStop }
      return (
        <DraggableCore { ...coreProps } nodeRef={(props.nodeRef as unknown) || localNodeRef}>
          {{ default: () => clonedChildren }}
        </DraggableCore>
      );
    };
  }
})

export { Draggable as default, DraggableCore }
