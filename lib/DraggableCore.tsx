import {
  defineComponent,
  cloneVNode,
  ref,
  onMounted,
  reactive,
  onUnmounted,
  renderSlot,
  isVNode,
} from 'vue';
import VueTypes from 'vue-types'
import get from 'lodash/get'

import {
  matchesSelectorAndParentsTo,
  addEvent,
  removeEvent,
  addUserSelectStyles,
  getTouchIdentifier,
  removeUserSelectStyles
} from './utils/domFns';
import { createCoreData, getControlPosition, snapToGrid } from './utils/positionFns';
import { prop_is_not_node } from './utils/shims';
import log from './utils/log';
import { EventHandler, MouseTouchEvent, DraggableData, DraggableCoreDefaultProps, DraggableCoreProps } from './utils/types'

// Simple abstraction for dragging events names.
const eventsFor = {
  touch: {
    start: 'touchstart',
    move: 'touchmove',
    stop: 'touchend'
  },
  mouse: {
    start: 'mousedown',
    move: 'mousemove',
    stop: 'mouseup'
  }
};

export const defaultDraggableEventHandler = (e: MouseEvent, data: DraggableData): void | boolean => true
const funcVoid = function () {}

// Default to mouse events.
let dragEventFor = eventsFor.mouse;

export const draggableCoreDefaultProps: DraggableCoreDefaultProps = {
  allowAnyClick: VueTypes.bool.def(false),
  disabled: VueTypes.bool.def(false),
  enableUserSelectHack: VueTypes.bool.def(true),
  startFn: VueTypes.func.def(defaultDraggableEventHandler).def(funcVoid),
  dragFn: VueTypes.func.def(defaultDraggableEventHandler).def(funcVoid),
  stopFn: VueTypes.func.def(defaultDraggableEventHandler).def(funcVoid),
  scale: VueTypes.number.def(1),
}

export const draggableCoreProps: DraggableCoreProps = {
  ...draggableCoreDefaultProps,
  cancel: VueTypes.string,
  offsetParent: VueTypes.custom(prop_is_not_node, 'Draggable\'s offsetParent must be a DOM Node.'),
  grid: VueTypes.arrayOf(VueTypes.number),
  handle: VueTypes.string,
  nodeRef: VueTypes.object.def(null)
}

const componentName = 'DraggableCore'

export default defineComponent({
  compatConfig: { MODE: 3 },
  name: componentName,
  inheritAttrs: false,
  props: {
    ...draggableCoreProps,
    // style: dontSetMe('style', componentName),
    // class: dontSetMe('class', componentName),
    // transform: dontSetMe('transform', componentName),
  },
  setup(props, { slots, emit }){
    const rootElement = ref(null)
    const displayName: string = 'DraggableCore';
    const state = reactive({
      dragging: false,
      // Used while dragging to determine deltas.
      lastX: NaN,
      lastY: NaN,
      touchIdentifier: null,
      mounted: false
    })

    const findDOMNode = (): HTMLElement => {
      return get(props, 'nodeRef.value') || rootElement.value;
    }

    const handleDrag: EventHandler<MouseTouchEvent> = e => {
      // Get the current drag point from the event. This is used as the offset.
      const position = getControlPosition(e, { props, findDOMNode }, state.touchIdentifier);
      if (position == null) return;
      let { x, y } = position;
  
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
      const shouldUpdate = props.dragFn?.(e, coreEvent);
      if (shouldUpdate === false || state.mounted === false) {
        try {
          handleDragStop(new MouseEvent('mouseup') as MouseTouchEvent);
        } catch (err) {
          // Old browsers
          const event = ((document.createEvent('MouseEvents') as MouseTouchEvent))
          event.initMouseEvent('mouseup', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
          handleDragStop(event);
        }
        return;
      }
  
      state.lastX = x;
      state.lastY = y;
    };

    const handleDragStop: EventHandler<MouseTouchEvent> = e => {
      if (!state.dragging) return;
      
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
      const shouldContinue = props.stopFn?.(e, coreEvent);
      if (shouldContinue === false || state.mounted === false) return false;
  
      const thisNode = findDOMNode();
      if (thisNode) {
        // Remove user-select hack
        if (props.enableUserSelectHack) removeUserSelectStyles(thisNode.ownerDocument);
      }
  
      log('DraggableCore: handleDragStop: %j', coreEvent);
  
      // Reset the el.
      state.dragging = false;
      state.lastX = NaN;
      state.lastY = NaN;
  
      if (thisNode) {
        // Remove event handlers
        log('DraggableCore: Removing handlers');
        removeEvent(thisNode.ownerDocument, dragEventFor.move, handleDrag);
        removeEvent(thisNode.ownerDocument, dragEventFor.stop, handleDragStop);
      }
    };

    const handleDragStart: EventHandler<MouseTouchEvent> = e => {
      // Make it possible to attach event handlers on top of this one.
      emit('mousedown', e)
  
      // Only accept left-clicks.
      if (
        !props.allowAnyClick
        && typeof e.button === 'number'
        && e.button !== 0
      ) return false;
  
      // Get nodes. Be sure to grab relative document (could be iframed)
      const thisNode = findDOMNode();
      if (!get(thisNode, 'ownerDocument.body')) {
        throw new Error('<DraggableCore> not mounted on DragStart!');
      }
      const { ownerDocument } = thisNode;
  
      // Short circuit if handle or cancel prop was provided and selector doesn't match.
      if (
        props.disabled
        || (!(e.target instanceof ownerDocument.defaultView.Node))
        || (props.handle && !matchesSelectorAndParentsTo(e.target, props.handle, thisNode))
        || (props.cancel && matchesSelectorAndParentsTo(e.target, props.cancel, thisNode))) {
        return;
      }
  
      // Prevent scrolling on mobile devices, like ipad/iphone.
      // Important that this is after handle/cancel.
      if (e.type === 'touchstart') e.preventDefault();
  
      // Set touch identifier in component state if this is a touch event. This allows us to
      // distinguish between individual touches on multitouch screens by identifying which
      // touchpoint was set to this element.
      const touchIdentifier = getTouchIdentifier(e);
      state.touchIdentifier = touchIdentifier;
      // Get the current drag point from the event. This is used as the offset.
      const position = getControlPosition(e, { props, findDOMNode }, touchIdentifier);
      if (position == null) return;
      const { x, y } = position;
  
      // Create an event object with all the data parents need to make a decision here.
      const coreEvent = createCoreData({ props, findDOMNode, state }, x, y);
  
      log('DraggableCore: handleDragStart: %j', coreEvent);
  
      // Call event handler. If it returns explicit false, cancel.
      log('calling', props.startFn);
      const shouldUpdate = props.startFn(e, coreEvent);
      if (shouldUpdate === false || state.mounted === false) return;

      // Add a style to the body to disable user-select. This prevents text from
      // being selected all over the page.
      if (props.enableUserSelectHack) addUserSelectStyles(ownerDocument);
  
      // Initiate dragging. Set the current x and y as offsets
      // so we know how much we've moved during the drag. This allows us
      // to drag elements around even if they have been moved, without issue.
      state.dragging = true;
      state.lastX = x;
      state.lastY = y;
  
      // Add events to the document directly so we catch when the user's mouse/touch moves outside of
      // this element. We use different events depending on whether or not we have detected that this
      // is a touch-capable device.
      addEvent(ownerDocument, dragEventFor.move, handleDrag);
      addEvent(ownerDocument, dragEventFor.stop, handleDragStop);
    };

    const onMousedown: EventHandler<MouseTouchEvent> = e => {
      dragEventFor = eventsFor.mouse; // on touchscreen laptops we could switch back to mouse
      return handleDragStart(e);
    };

    // const onMoueDown = (e: MouseTouchEvent) => {
    //   dragEventFor = eventsFor.mouse // on touchscreen laptops we could switch back to mouse
    //   return handleDragStart(e)
    // }

    const onMouseup: EventHandler<MouseTouchEvent> = e => {
      dragEventFor = eventsFor.mouse;
  
      return handleDragStop(e);
    };

    const onTouchStart: EventHandler<MouseTouchEvent> = e => {
      // We're on a touch device now, so change the event handlers
      dragEventFor = eventsFor.touch;
  
      return handleDragStart(e);
    };

    const onTouchend: EventHandler<MouseTouchEvent> = e => {
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
      // Remove any leftover event handlers. Remove both touch and mouse handlers in case
      // some browser quirk caused a touch event to fire during a mouse move, or vice versa.
      const thisNode = findDOMNode();
      if (thisNode) {
        const { ownerDocument } = thisNode;
        removeEvent(ownerDocument, eventsFor.mouse.move, handleDrag);
        removeEvent(ownerDocument, eventsFor.touch.move, handleDrag);
        removeEvent(ownerDocument, eventsFor.mouse.stop, handleDragStop);
        removeEvent(ownerDocument, eventsFor.touch.stop, handleDragStop);
        removeEvent(thisNode, eventsFor.touch.start, onTouchStart, { passive: false });
        if (props.enableUserSelectHack) removeUserSelectStyles(ownerDocument);
      }
    });

    return () => {
      const slotContent = renderSlot(slots, 'default');
      let children = slotContent.children;

      if (!Array.isArray(children)) {
        children = []; // 如果不是数组，则使用空数组
      }

      const child = get(children, '0.children[0]')
      const clonedChildren = isVNode(child) ? cloneVNode(child, { onMousedown, onMouseup, onTouchend, ref: rootElement }) : child;

      return clonedChildren;
    };
  }
})