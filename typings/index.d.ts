declare module '@marsio/vue-draggable' {
  import { DefineComponent, PropType, Ref } from 'vue';
  import { DraggableProps } from '../utils/types'

  interface ControlPosition {x: number, y: number}
  interface PositionOffsetControlPosition {x: number|string, y: number|string}
  interface DraggableBounds {
    left?: number;
    right?: number;
    top?: number;
    bottom?: number;
  }
  interface DraggableData {
    node: HTMLElement,
    x: number, y: number,
    deltaX: number, deltaY: number,
    lastX: number, lastY: number
  }

  type DraggableEvent = MouseEvent | TouchEvent
  type DraggableEventHandler = (e: MouseEvent, data: DraggableData) => void | false
  type DraggableCoreProps = {
    allowAnyClick: boolean,
    disabled: boolean,
    enableUserSelectHack: boolean,
    startFn: DraggableEventHandler,
    dragFn: DraggableEventHandler,
    stopFn: DraggableEventHandler,
    scale: number,
    cancel: string,
    offsetParent: HTMLElement,
    grid: [number, number],
    handle: string
  }

  type DraggableProps = DraggableCoreProps & {
    axis: Axis,
    bounds: Bounds,
    defaultClassName: string
    defaultClassNameDragging: string
    defaultClassNameDragged: string
    position: ControlPosition
    positionOffset: PositionOffsetControlPosition
    defaultPosition: PositionOffsetControlPosition
  }
  
  const Draggable: DefineComponent<Partial<DraggableProps>>;
  const DraggableCore: DefineComponent<Partial<DraggableCoreProps>>;
  export { Draggable as default, DraggableCore};

  export {
    DraggableBounds, DraggableData, DraggableEvent,
    DraggableCoreProps, DraggableProps, DraggableEventHandler,
    PositionOffsetControlPosition, ControlPosition
  }
}
