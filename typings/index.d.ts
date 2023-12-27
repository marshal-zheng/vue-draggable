declare module 'vue-draggable' {
  import { DefineComponent, PropType } from 'vue';

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

  export interface DraggableProps {
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
  export default Draggable;
}
