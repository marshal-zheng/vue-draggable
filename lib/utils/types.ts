import VueTypes from 'vue-types'

type DraggableEventHandler = (e: MouseEvent, data: DraggableData) => void | false

interface DraggableData {
  node: HTMLElement,
  x: number, y: number,
  deltaX: number, deltaY: number,
  lastX: number, lastY: number
}

export interface CompatibleElement extends Node {
  detachEvent?: (event: string, handler: EventListener) => void;
  attachEvent?: (event: string, handler: EventListener) => void;
}

interface Bounds {
  left?: number, top?: number, right?: number, bottom?: number
}
interface ControlPosition {x: number, y: number}
interface PositionOffsetControlPosition {x: number|string, y: number|string}
type EventHandler<T> = (e: T) => void | false

class SVGElement extends HTMLElement {
}

// Missing targetTouches
class TouchEvent2 extends TouchEvent {
  changedTouches!: TouchList
  targetTouches!: TouchList
}

type MouseTouchEvent = MouseEvent & TouchEvent2
type DraggableCoreDefaultProps = {
  allowAnyClick: typeof VueTypes.bool,
  disabled: typeof VueTypes.bool,
  enableUserSelectHack: typeof VueTypes.bool,
  // startFn: DraggableEventHandler,
  startFn: typeof VueTypes.func,
  dragFn: typeof VueTypes.func,
  stopFn: typeof VueTypes.func,
  // dragFn: DraggableEventHandler,
  // stopFn: DraggableEventHandler,
  scale: typeof VueTypes.number
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type DraggableCoreAdditionalProps = {
  cancel: typeof VueTypes.string,
  offsetParent: any,
  grid: any,
  handle: typeof VueTypes.string,
  nodeRef?: any 
};
/* eslint-disable @typescript-eslint/no-explicit-any */

type DraggableCoreProps = DraggableCoreDefaultProps & DraggableCoreAdditionalProps

/* eslint-disable @typescript-eslint/no-explicit-any */
type DraggableAdditionalProps = {
  axis: typeof VueTypes.string,
  bounds: typeof VueTypes.object,
  defaultClassName: typeof VueTypes.string
  defaultClassNameDragging: typeof VueTypes.string
  defaultClassNameDragged: typeof VueTypes.string
  position: any
  positionOffset: any
  defaultPosition: any
}
/* eslint-disable @typescript-eslint/no-explicit-any */

type DraggableProps = DraggableCoreProps & DraggableAdditionalProps

type PrimaryKey = string | number | symbol

type Kv<T = any> = Record<PrimaryKey, T>;

export {
  TouchEvent2,
  DraggableCoreDefaultProps,
  DraggableCoreAdditionalProps,
  SVGElement,
  EventHandler,
  DraggableEventHandler,
  DraggableData,
  Bounds,
  ControlPosition,
  PositionOffsetControlPosition,
  MouseTouchEvent,
  DraggableCoreProps,
  DraggableProps,
  Kv
}
