export function externalFunction(componentInstance: any): void {
  // 调用组件的内部方法
  if (componentInstance && componentInstance.internalMethod) {
    componentInstance.internalMethod();
  }
}