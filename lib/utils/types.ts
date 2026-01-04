import { Ref } from 'vue'

type DraggableEvent = MouseEvent | TouchEvent | PointerEvent
type DraggableEventHandler = (e: DraggableEvent, data: DraggableData) => void | false

interface DraggableData {
  node: HTMLElement,
  x: number, y: number,
  deltaX: number, deltaY: number,
  lastX: number, lastY: number
}

interface CompatibleElement extends Node {
  detachEvent?: (event: string, handler: EventListener) => void;
  attachEvent?: (event: string, handler: EventListener) => void;
}

type Axis = 'both' | 'x' | 'y' | 'none';

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
type MouseTouchPointerEvent = MouseTouchEvent | PointerEvent
type AutoScrollContainerInput = HTMLElement | Window | string
type AutoScrollContainerProp = AutoScrollContainerInput | AutoScrollContainerInput[] | null
type DraggableCoreDefaultProps = {
  allowAnyClick: boolean,
  disabled: boolean,
  allowMobileScroll: boolean,
  autoScroll: boolean,
  autoScrollThreshold: number,
  autoScrollMaxSpeed: number,
  autoScrollAxis: Axis,
  autoScrollIncludeWindow: boolean,
  autoScrollContainer: AutoScrollContainerProp,
  cancelInteractiveElements: boolean,
  enableClickSuppression: boolean,
  clickSuppressionDuration: number,
  dragStartThreshold: number,
  dragStartDelay: number,
  dragStartDelayTolerance: number,
  enableUserSelectHack: boolean,
  useRafDrag: boolean,
  startFn: DraggableEventHandler,
  dragFn: DraggableEventHandler,
  stopFn: DraggableEventHandler,
  scale: number
};

type DraggableCoreAdditionalProps = {
  cancel: string,
  offsetParent: HTMLElement,
  grid: [number, number],
  handle: string,
  nodeRef?: Ref<HTMLElement | null> 
};

type DraggableCoreProps = DraggableCoreDefaultProps & DraggableCoreAdditionalProps

/* eslint-disable @typescript-eslint/no-explicit-any */
type DraggableAdditionalProps = {
  axis: Axis,
  directionLock: boolean,
  directionLockThreshold: number,
  bounds: Bounds,
  defaultClassName: string
  defaultClassNameDragging: string
  defaultClassNameDragged: string
  position: ControlPosition
  positionOffset: PositionOffsetControlPosition
  defaultPosition: PositionOffsetControlPosition
}
/* eslint-disable @typescript-eslint/no-explicit-any */

type DraggableProps = DraggableCoreProps & DraggableAdditionalProps

type PrimaryKey = string | number | symbol

type Kv<T = any> = Record<PrimaryKey, T>;

interface DraggableBounds {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}


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
  MouseTouchPointerEvent,
  DraggableCoreProps,
  DraggableProps,
  Kv,
  DraggableBounds,
  CompatibleElement,
  DraggableEvent,
  Axis
}
