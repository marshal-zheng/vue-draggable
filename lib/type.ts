import { Ref } from 'vue';

export type DraggableEvent = MouseEvent | TouchEvent

export interface DraggableData {
  x: number;
  y: number;
  node: HTMLElement;
  deltaX: number;
  lastX: number;
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
  enableUserSelectHack: boolean,
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
  bounds?: DraggableBounds | string | false;
  defaultClassName?: string;
  defaultClassNameDragging?: string;
  defaultClassNameDragged?: string;
  defaultPosition?: ControlPosition;
  positionOffset?: PositionOffsetControlPosition;
  position?: ControlPosition;
}