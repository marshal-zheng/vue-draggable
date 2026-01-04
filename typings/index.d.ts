declare module '@marsio/vue-draggable' {
  import type { DefineComponent, Ref } from 'vue'

  export type Axis = 'both' | 'x' | 'y' | 'none'

  export interface ControlPosition {
    x: number
    y: number
  }

  export interface PositionOffsetControlPosition {
    x: number | string
    y: number | string
  }

  export interface DraggableBounds {
    left?: number
    right?: number
    top?: number
    bottom?: number
  }

  export interface DraggableData {
    node: HTMLElement
    x: number
    y: number
    deltaX: number
    deltaY: number
    lastX: number
    lastY: number
  }

  export type DraggableEvent = MouseEvent | TouchEvent | PointerEvent
  export type DraggableEventHandler = (e: DraggableEvent, data: DraggableData) => void | false

  export interface DraggableCoreProps {
    allowAnyClick?: boolean
    disabled?: boolean
    enableUserSelectHack?: boolean
    useRafDrag?: boolean
    scale?: number

    cancel?: string
    offsetParent?: HTMLElement
    grid?: [number, number]
    handle?: string
    nodeRef?: Ref<HTMLElement | null>

    allowMobileScroll?: boolean

    autoScroll?: boolean
    autoScrollThreshold?: number
    autoScrollMaxSpeed?: number
    autoScrollAxis?: Axis
    autoScrollIncludeWindow?: boolean
    autoScrollContainer?: string | HTMLElement | Window | Array<string | HTMLElement | Window> | null

    cancelInteractiveElements?: boolean
    enableClickSuppression?: boolean
    clickSuppressionDuration?: number

    dragStartThreshold?: number
    dragStartDelay?: number
    dragStartDelayTolerance?: number

    startFn?: DraggableEventHandler
    dragFn?: DraggableEventHandler
    stopFn?: DraggableEventHandler
  }

  export interface DraggableProps extends DraggableCoreProps {
    axis?: Axis
    directionLock?: boolean
    directionLockThreshold?: number
    bounds?: DraggableBounds | string | false
    defaultClassName?: string
    defaultClassNameDragging?: string
    defaultClassNameDragged?: string
    defaultPosition?: ControlPosition
    positionOffset?: PositionOffsetControlPosition
    position?: ControlPosition
  }

  const Draggable: DefineComponent<DraggableProps>
  const DraggableCore: DefineComponent<DraggableCoreProps>

  export { DraggableCore }
  export default Draggable
}
