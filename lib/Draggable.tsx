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
} from 'vue'
import get from 'lodash/get'
import VueTypes from 'vue-types'
import clsx from 'clsx';
import {createCSSTransform, createSVGTransform} from './utils/domFns';
import {canDragX, canDragY, createDraggableData, getBoundPosition} from './utils/positionFns';
import {dontSetMe} from './utils/shims';
import DraggableCore from './DraggableCore';
import log from './utils/log';
import type { DraggableEventHandler, PositionOffsetControlPosition } from './utils/types';
import { draggableCoreProps } from './DraggableCore';

export const draggableProps = {
  ...draggableCoreProps,
  axis: VueTypes.oneOf(['both', 'x', 'y', 'none']).def('both'),
  bounds: VueTypes.oneOfType([
    VueTypes.shape({
      left: VueTypes.number,
      right: VueTypes.number,
      top: VueTypes.number,
      bottom: VueTypes.number
    }),
    VueTypes.string,
    VueTypes.oneOf([false])
  ]).def(false),
  defaultClassName: VueTypes.string.def('vue-draggable'),
  defaultClassNameDragging: VueTypes.string.def('vue-draggable-dragging'),
  defaultClassNameDragged: VueTypes.string.def('vue-draggable-dragged'),
  defaultPosition: VueTypes.shape({
    x: VueTypes.number,
    y: VueTypes.number
  }).def({x: 0, y: 0}),
  positionOffset: VueTypes.shape({
    x: VueTypes.oneOfType([VueTypes.number, VueTypes.string]),
    y: VueTypes.oneOfType([VueTypes.number, VueTypes.string])
  }),
  position: VueTypes.shape({
    x: VueTypes.number,
    y: VueTypes.number
  }).def(undefined)
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
  setup(props, { slots }){
    const rootElement = ref(null)
    if (props.position && !(props.dragFn || props.stopFn)) {
      // eslint-disable-next-line no-console
      console.warn('A `position` was applied to this <Draggable>, without drag handlers. This will make this ' +
        'component effectively undraggable. Please attach `onDrag` or `onStop` handlers so you can adjust the ' +
        '`position` of this element.');
    }
    const state = reactive({
      // Whether or not we are currently dragging.
      dragging: false,
      // Whether or not we have been dragged before.
      dragged: false,
      // Current transform x and y.
      x: props.position ? props.position.x : props.defaultPosition.x,
      y: props.position ? props.position.y : props.defaultPosition.y,
      prevPropsPosition: {...props.position},
      // Used for compensating for out-of-bounds drags
      slackX: 0, slackY: 0,

      // Can only determine if SVG after mounting
      isElementSVG: false
    })

    // const position = ref(props.position);
    // const prevPropsPosition = ref(null);

    const findDOMNode = (): HTMLElement => {
      return get(props, 'nodeRef.value') || rootElement.value;
    }

    onMounted(() => {
      if(typeof window.SVGElement !== 'undefined' && findDOMNode() instanceof window.SVGElement) {
        state.isElementSVG = true
      }
    })

    onUnmounted(() => {
      state.dragging = false
    })
  
    const onDragStart: DraggableEventHandler = (e, coreData) => {
      log('Draggable: onDragStart: %j', coreData);
  
      // Short-circuit if user's callback killed it.
      const shouldStart = props.startFn?.(e, createDraggableData({ props, state }, coreData));
      // Kills start event on core as well, so move handlers are never bound.
      if (shouldStart === false) return false;

      state.dragging = true
      state.dragged = true
    };

    const onDrag: DraggableEventHandler = (e, coreData) => {
      if (!state.dragging) return false;
      log('Draggable: onDrag: %j', coreData);
  
      const uiData = createDraggableData({ props, state }, coreData);
  
      const newState = {
        x: uiData.x,
        y: uiData.y,
        slackX: 0,
        slackY: 0,
      };
  
      // Keep within bounds.
      if (props.bounds) {
        // Save original x and y.
        const {x, y} = newState;
  
        // Add slack to the values used to calculate bound position. This will ensure that if
        // completely removed.
        newState.x += state.slackX;
        newState.y += state.slackY;
  
        // Get bound position. This will ceil/floor the x and y within the boundaries.
        const [newStateX, newStateY] = getBoundPosition({ props, findDOMNode }, newState.x, newState.y);
        newState.x = newStateX;
        newState.y = newStateY;
  
        // Recalculate slack by noting how much was shaved by the boundPosition handler.
        newState.slackX = state.slackX + (x - newState.x);
        newState.slackY = state.slackY + (y - newState.y);
  
        // Update the event we fire to reflect what really happened after bounds took effect.
        uiData.x = newState.x;
        uiData.y = newState.y;
        uiData.deltaX = newState.x - (state.x ?? 0);
        uiData.deltaY = newState.y - (state.y ?? 0);
      }
  
      // Short-circuit if user's callback killed it.
      const shouldUpdate = props.dragFn?.(e, uiData);
      if (shouldUpdate === false) return false;

      Object.keys(newState).forEach((key: string) => {
        state[key] = newState[key]
      })
    };

    const onDragStop: DraggableEventHandler = (e, coreData) => {
      if (!state.dragging) return false;
  
      // Short-circuit if user's callback killed it.
      const shouldContinue = props.stopFn?.(e, createDraggableData({ props, state }, coreData));
      if (shouldContinue === false) return false;
  
      log('Draggable: onDragStop: %j', coreData);
  
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
        newState.x = x as number;
        newState.y = y as number;
      }

      Object.keys(newState).forEach((key: string) => {
        state[key] = newState[key]
      })
    };

    return () => {
      /* eslint-disable @typescript-eslint/no-unused-vars */
      const {
        axis,
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
      const className = clsx(defaultClassName, {
        [defaultClassNameDragging]: state.dragging,
        [defaultClassNameDragged]: state.dragged
      });

      const child = slots.default ? slots.default()[0] : null;
      if (!child) return null;
      const clonedChildren = cloneVNode(child, {
        class: className,
        style,
        transform: svgTransform
      });


      const coreProps = { ...draggableCoreProps, startFn: onDragStart, dragFn: onDrag, stopFn: onDragStop }
      return (
        <DraggableCore ref={rootElement} { ...coreProps }>
          { clonedChildren }
        </DraggableCore>
      );
    };
  }
})

export { Draggable as default, DraggableCore }