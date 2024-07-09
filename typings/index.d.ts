declare module '@marsio/vue-draggable' {
  import { DefineComponent, PropType, Ref } from 'vue';

  export interface DraggableBounds {
    left?: number;
    right?: number;
    top?: number;
    bottom?: number;
  }

  export interface DraggableData {
    x: number;
    y: number;
    deltaX: number;
    deltaY: number;
    lastX: number;
    lastY: number;
  }

  export type ControlPosition = { x: number; y: number };
  export type PositionOffsetControlPosition = { x: number | string; y: number | string };
  export type DraggableEventHandler = (e: MouseEvent, data: DraggableData) => void | false

  export interface DraggableCoreProps {
    allowAnyClick: boolean,
    cancel: string,
    disabled: boolean,
    enableUserSelectHack: boolean,
    offsetParent: HTMLElement,
    grid: [number, number],
    handle: string,
    nodeRef?: Ref<HTMLElement | undefined>,
    startFn: DraggableEventHandler,
    dragFn: DraggableEventHandler,
    stopFn: DraggableEventHandler,
    scale: number
  }

  export interface DraggableProps extends DraggableCoreProps {
    axis?: 'both' | 'x' | 'y' | 'none';
    bounds?: DraggableBounds | string | false;
    defaultClassName?: string;
    defaultClassNameDragging?: string;
    defaultClassNameDragged?: string;
    defaultPosition?: ControlPosition;
    positionOffset?: PositionOffsetControlPosition;
    position?: ControlPosition;
  }

  const Draggable: DefineComponent<DraggableProps>;
  const DraggableCore: DefineComponent<DraggableCoreProps>;
  export { Draggable as default, DraggableCore};
}
