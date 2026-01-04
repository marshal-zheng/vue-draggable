
/**
 * Searches for an element in an array or TouchList that satisfies the provided callback function.
 * @param {T[] | TouchList} array - The array or TouchList to search.
 * @param {(element: T, index: number, arr: T[] | TouchList) => boolean} callback - A function that accepts up to three arguments.
 * The findInArray method calls the callback function one time for each element in the array, in order, until the callback returns true.
 * If such an element is found, findInArray immediately returns that element value. Otherwise, findInArray returns undefined.
 * @returns {any} The found element in the array, or undefined if not found.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function findInArray<T>(array: T[] | TouchList, callback: (element: T, index: number, arr: T[] | TouchList) => boolean): any {
  for (let i = 0, length = array.length; i < length; i++) {
    const element = array instanceof TouchList ? array.item(i) : array[i];
    if (element !== null && callback(element as T, i, array)) {
      return element;
    }
  }
}

/**
 * Checks if the passed argument is a function.
 * @param {unknown} func - The argument to check.
 * @returns {boolean} True if the argument is a function, false otherwise.
 */
export function isFunction(func: unknown): boolean {
  return typeof func === 'function' || Object.prototype.toString.call(func) === '[object Function]';
}

/**
 * Checks if the passed argument is a number.
 * @param {unknown} num - The argument to check.
 * @returns {boolean} True if the argument is a number and not NaN, false otherwise.
 */
export function isNum (num: unknown): boolean {
  return typeof num === 'number' && !isNaN(num)
}

/**
 * Converts a string to an integer.
 * @param {string} a - The string to convert.
 * @returns {number} The converted integer.
 */
export function int (a: string): number {
  return parseInt(a, 10)
}

/**
 * Creates a custom Vue prop type that fails validation.
 * @param {string} propsName - The name of the prop.
 * @param {string} componentName - The name of the component.
 */
export function dontSetMe(propsName: string, _componentName: string) {
  void _componentName;
  return {
    validator(): boolean {
      if (!propsName) {
        return false;
      }
      // 如果有其他验证逻辑，可以在这里添加
      return true;
    }
  };
}

/**
 * Checks if the passed argument is a DOM Node but not a text node.
 * @param {unknown} node - The argument to check.
 * @returns {boolean} True if the argument is a DOM Node and not a text node, false otherwise.
 */
export function propIsNotNode(node: unknown): boolean {
  return typeof node === 'object' && node !== null && 'nodeType' in node && (node as Node).nodeType === 1;
}