import { Ref } from 'vue';

export type DraggableEvent = MouseEvent | TouchEvent | PointerEvent

export interface DraggableData {
  x: number;
  y: number;
  node: HTMLElement;
  deltaX: number;
  deltaY: number;
  lastX: number;
  lastY: number;
}

export type Axis = 'both' | 'x' | 'y' | 'none';
export type ControlPosition = { x: number; y: number };
export type PositionOffsetControlPosition = { x: number | string; y: number | string };
export type DraggableEventHandler = (e: DraggableEvent, data: DraggableData) => void | false
export interface DraggableBounds {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}

export interface DraggableCoreProps {
  allowAnyClick: boolean,
  cancel: string,
  disabled: boolean,
  allowMobileScroll?: boolean,
  autoScroll?: boolean,
  autoScrollThreshold?: number,
  autoScrollMaxSpeed?: number,
  autoScrollAxis?: Axis,
  autoScrollIncludeWindow?: boolean,
  autoScrollContainer?: HTMLElement | Window | string | Array<HTMLElement | Window | string> | null,
  cancelInteractiveElements?: boolean,
  enableClickSuppression?: boolean,
  clickSuppressionDuration?: number,
  dragStartThreshold?: number,
  dragStartDelay?: number,
  dragStartDelayTolerance?: number,
  enableUserSelectHack: boolean,
  useRafDrag?: boolean,
  offsetParent: HTMLElement,
  grid: [number, number],
  handle: string,
  nodeRef?: Ref<HTMLElement>,
  startFn: DraggableEventHandler,
  dragFn: DraggableEventHandler,
  stopFn: DraggableEventHandler,
  scale: number
}

export interface DraggableProps extends DraggableCoreProps {
  axis?: Axis;
  directionLock?: boolean;
  directionLockThreshold?: number;
  bounds?: DraggableBounds | string | false;
  defaultClassName?: string;
  defaultClassNameDragging?: string;
  defaultClassNameDragged?: string;
  defaultPosition?: ControlPosition;
  positionOffset?: PositionOffsetControlPosition;
  position?: ControlPosition;
}
