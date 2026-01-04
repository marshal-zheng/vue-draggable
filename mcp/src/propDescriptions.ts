export const DRAGGABLE_SPECIFIC_PROP_DESCRIPTIONS: Record<string, string> = {
  axis: '限制拖拽方向',
  bounds:
    "拖拽边界。可以是边界对象，CSS 选择器如 `'parent'` 或 `'.container'`，或 `false` 不限制",
  position: '受控模式的位置，设置后必须通过 `dragFn` 更新',
  defaultPosition: '初始位置（仅初始化时生效）',
  positionOffset: '位置偏移量',
  directionLock: '锁定到首次移动的方向',
  directionLockThreshold: '方向锁定的阈值像素',
  defaultClassName: '默认类名',
  defaultClassNameDragging: '拖拽中的类名',
  defaultClassNameDragged: '拖拽后的类名',
}

export const DRAGGABLE_CORE_PROP_DESCRIPTIONS: Record<string, string> = {
  disabled: '禁用拖拽',
  allowAnyClick: '允许任意鼠标按键触发',
  handle: '拖拽手柄 CSS 选择器',
  cancel: '阻止拖拽的元素选择器',
  grid: '网格吸附，如 `[25, 25]`',
  scale: '缩放比例（用于缩放容器内的拖拽）',
  offsetParent: '偏移父元素',
  nodeRef: '拖拽节点的 ref 引用',
  enableUserSelectHack: '启用防止文本选中的 hack',
  allowMobileScroll: '允许移动端滚动（触摸事件不阻止默认行为）',
  autoScroll: '启用边缘自动滚动',
  autoScrollThreshold: '触发自动滚动的边缘距离（像素）',
  autoScrollMaxSpeed: '自动滚动最大速度',
  autoScrollAxis: '自动滚动方向',
  autoScrollIncludeWindow: '自动滚动是否包含 window',
  autoScrollContainer: '自动滚动容器',
  cancelInteractiveElements: '自动取消交互元素（input, textarea 等）上的拖拽',
  enableClickSuppression: '拖拽后抑制 click 事件',
  clickSuppressionDuration: 'click 抑制持续时间（毫秒）',
  dragStartThreshold: '触发拖拽的最小移动距离（像素）',
  dragStartDelay: '触发拖拽的延迟时间（毫秒）',
  dragStartDelayTolerance: '延迟期间允许的移动容差（像素）',
  useRafDrag: '使用 requestAnimationFrame 优化性能',
}

export const EVENT_CALLBACK_DESCRIPTIONS: Record<'startFn' | 'dragFn' | 'stopFn', string> = {
  startFn: '拖拽开始，返回 `false` 取消拖拽',
  dragFn: '拖拽中，返回 `false` 取消本次移动',
  stopFn: '拖拽结束',
}

