import VueTypes, { VueTypeDef } from 'vue-types'

type ValidatorFunction<T> = (value: T) => boolean

export function findInArray<T>(array: T[] | TouchList, callback: (element: T, index: number, arr: T[] | TouchList) => boolean): any {
  for (let i = 0, length = array.length; i < length; i++) {
    const element = array instanceof TouchList ? array.item(i) : array[i];
    if (element !== null && callback(element as T, i, array)) {
      return element;
    }
  }
  return undefined;
}

export function isFunction(func: unknown): boolean {
  return typeof func === 'function' || Object.prototype.toString.call(func) === '[object Function]';
}

export function isNum (num: unknown): boolean {
  return typeof num === 'number' && !isNaN(num)
}

export function int (a: string): number {
  return parseInt(a, 10)
}

export function dontSetMe <T> (propsName: string, componentName: string): VueTypeDef<T> {
  const failed_prop_type: ValidatorFunction<T> = () => !propsName
  const message = `Invalid prop ${propsName} passed to ${componentName} - do not set this, set it on the child.`
  return VueTypes.custom(failed_prop_type, message)
}

export function prop_is_not_node(node: unknown): boolean {
  return typeof node === 'object' && node !== null && 'nodeType' in node && (node as Node).nodeType === 1;
}
