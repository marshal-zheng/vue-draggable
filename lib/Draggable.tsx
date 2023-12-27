import {
  defineComponent,
  reactive,
  onMounted,
  onUnmounted,
  ref,
  renderSlot,
  isVNode,
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
import type { DraggableEventHandler } from './utils/types';
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
  }).def(null)
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
      const shouldStart = props.startFn(e, createDraggableData({ props, state }, coreData));
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
        uiData.deltaX = newState.x - state.x;
        uiData.deltaY = newState.y - state.y;
      }
  
      // Short-circuit if user's callback killed it.
      const shouldUpdate = props.dragFn(e, uiData);
      if (shouldUpdate === false) return false;

      Object.keys(newState).forEach((key: string) => {
        state[key] = newState[key]
      })
    };

    const onDragStop: DraggableEventHandler = (e, coreData) => {
      if (!state.dragging) return false;
  
      // Short-circuit if user's callback killed it.
      const shouldContinue = props.stopFn(e, createDraggableData({ props, state }, coreData));
      if (shouldContinue === false) return false;
  
      log('Draggable: onDragStop: %j', coreData);
  
      const newState = {
        dragging: false,
        slackX: 0,
        slackY: 0
      };
  
      // If this is a controlled component, the result of this operation will be to
      // revert back to the old position. We expect a handler on `onDragStop`, at the least.
      const controlled = Boolean(props.position);
      if (controlled) {
        const { x, y } = props.position;
        newState.x = x;
        newState.y = y;
      }

      Object.keys(newState).forEach((key: string) => {
        state[key] = newState[key]
      })
    };

    return () => {
      const {
        axis,
        bounds,
        // children,
        defaultPosition,
        defaultClassName,
        defaultClassNameDragging,
        defaultClassNameDragged,
        position,
        positionOffset,
        scale,
        ...draggableCoreProps
      } = props;

      let style = {};
      let svgTransform = null;

      const controlled = Boolean(position);
      const draggable = !controlled || state.dragging;

      const validPosition = position || defaultPosition;

      const transformOpts = {
        // Set left if horizontal drag is enabled
        x: canDragX({ props }) && draggable ?
          state.x :
          validPosition.x,
  
        // Set top if vertical drag is enabled
        y: canDragY({ props }) && draggable ?
          state.y :
          validPosition.y
      };

      // If this element was SVG, we use the `transform` attribute.
      if (state.isElementSVG) {
        svgTransform = createSVGTransform(transformOpts, positionOffset);
      } else {
        // Add a CSS transform to move the element around. This allows us to move the element around
        // without worrying about whether or not it is relatively or absolutely positioned.
        // If the item you are dragging already has a transform set, wrap it in a <span> so <Draggable>
        // has a clean slate.
        style = createCSSTransform(transformOpts, positionOffset);
      }

      const slotContent = renderSlot(slots, 'default');
      let children = slotContent.children;

      if (!Array.isArray(children)) {
        children = []; // 如果不是数组，则使用空数组
      }

      // Mark with class while dragging
      const className = clsx(defaultClassName, {
        [defaultClassNameDragging]: state.dragging,
        [defaultClassNameDragged]: state.dragged
      });

      const clonedChildren = children.flatMap(child => {
        return isVNode(child) ? cloneVNode(child, {
          class: className,
          style: style,
          transform: svgTransform,
        }) : child;
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