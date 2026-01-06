#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const root = path.resolve(__dirname, '..')
const projectRoot = path.resolve(root, '..')

const INPUT_FILES = {
  core: path.join(projectRoot, 'lib/DraggableCore.tsx'),
  draggable: path.join(projectRoot, 'lib/Draggable.tsx'),
  sharedTypes: path.join(projectRoot, 'lib/utils/types.ts'),
}

function getJSDocDescription(node, sourceFile) {
  const jsDoc = node.jsDoc || (node.parent && node.parent.jsDoc)
  if (!jsDoc || !jsDoc.length) return ''
  return compact(jsDoc[0].comment || '')
}

const OUTPUT_FILE = path.join(root, 'src/props.generated.ts')
const OUTPUT_TYPES_FILE = path.join(root, 'src/types.generated.ts')

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function compact(text) {
  return text.replace(/\s+/g, ' ').trim()
}

function parseSourceFile(filePath) {
  return ts.createSourceFile(filePath, read(filePath), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

function getPropName(nameNode) {
  if (ts.isIdentifier(nameNode)) return nameNode.text
  if (ts.isStringLiteral(nameNode)) return nameNode.text
  return null
}

function findObjectInitializer(sourceFile, varName) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue
      if (declaration.name.text !== varName) continue
      if (!declaration.initializer) continue
      if (!ts.isObjectLiteralExpression(declaration.initializer)) {
        throw new Error(`${varName} initializer is not an object literal in ${sourceFile.fileName}`)
      }
      return declaration.initializer
    }
  }
  throw new Error(`Could not find exported const ${varName} in ${sourceFile.fileName}`)
}

function collectDirectPropNames(objectLiteral) {
  const names = []
  for (const prop of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    const name = getPropName(prop.name)
    if (!name) continue
    names.push(name)
  }
  return names
}

function extractRuntimeTypes(typeExpr, sourceFile) {
  if (!typeExpr) return []
  let expr = typeExpr
  if (ts.isAsExpression(expr) || ts.isTypeAssertionExpression(expr)) expr = expr.expression

  if (ts.isIdentifier(expr)) return [expr.text]
  if (ts.isArrayLiteralExpression(expr)) {
    const types = []
    for (const el of expr.elements) {
      if (ts.isIdentifier(el)) types.push(el.text)
      else types.push(compact(el.getText(sourceFile)))
    }
    return types
  }
  return [compact(expr.getText(sourceFile))]
}

function extractTsType(typeExpr, sourceFile) {
  if (!typeExpr) return null

  const asExpr = ts.isAsExpression(typeExpr) || ts.isTypeAssertionExpression(typeExpr) ? typeExpr : null
  if (asExpr) {
    const typeNode = asExpr.type
    if (ts.isTypeReferenceNode(typeNode)) {
      const typeName =
        ts.isIdentifier(typeNode.typeName) ? typeNode.typeName.text : compact(typeNode.typeName.getText(sourceFile))
      if (typeName === 'PropType' && typeNode.typeArguments?.length === 1) {
        return compact(typeNode.typeArguments[0].getText(sourceFile))
      }
    }
  }

  const runtimeTypes = extractRuntimeTypes(typeExpr, sourceFile)
  if (runtimeTypes.length === 1) {
    switch (runtimeTypes[0]) {
      case 'Boolean':
        return 'boolean'
      case 'String':
        return 'string'
      case 'Number':
        return 'number'
      case 'Array':
        return 'unknown[]'
      case 'Object':
        return 'unknown'
      case 'Function':
        return 'Function'
      default:
        return null
    }
  }
  return null
}

function extractBooleanLiteral(expr) {
  if (!expr) return null
  if (expr.kind === ts.SyntaxKind.TrueKeyword) return true
  if (expr.kind === ts.SyntaxKind.FalseKeyword) return false
  return null
}

function parsePropConfig(configObject, sourceFile) {
  let typeExpr = null
  let defaultExpr = null
  let requiredExpr = null
  let validatorExpr = null

  for (const prop of configObject.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    const key = getPropName(prop.name)
    if (!key) continue
    if (key === 'type') typeExpr = prop.initializer
    else if (key === 'default') defaultExpr = prop.initializer
    else if (key === 'required') requiredExpr = prop.initializer
    else if (key === 'validator') validatorExpr = prop.initializer
  }

  // Extract description from JSDoc
  let description = ''
  if (configObject.parent && ts.isPropertyAssignment(configObject.parent)) {
    description = getJSDocDescription(configObject.parent, sourceFile)
  }

  const runtimeTypes = extractRuntimeTypes(typeExpr, sourceFile)
  const tsType = extractTsType(typeExpr, sourceFile)
  const defaultText = defaultExpr ? compact(defaultExpr.getText(sourceFile)) : null
  const defaultIsFactory = !!defaultExpr && (ts.isArrowFunction(defaultExpr) || ts.isFunctionExpression(defaultExpr))
  const required = extractBooleanLiteral(requiredExpr)
  const validator = validatorExpr ? compact(validatorExpr.getText(sourceFile)) : null

  return {
    vueRuntimeTypes: runtimeTypes,
    tsType,
    default: defaultText,
    hasDefault: !!defaultExpr,
    defaultIsFactory,
    required,
    validator,
    sourceType: typeExpr ? compact(typeExpr.getText(sourceFile)) : null,
    description,
  }
}

function evaluatePropsObject(varName, varDecls, stack = []) {
  if (stack.includes(varName)) {
    throw new Error(`Circular props object reference: ${[...stack, varName].join(' -> ')}`)
  }
  const decl = varDecls.get(varName)
  if (!decl) throw new Error(`Unknown props object: ${varName}`)

  const propsMap = new Map()
  for (const prop of decl.objectLiteral.properties) {
    if (ts.isSpreadAssignment(prop)) {
      const spreadExpr = prop.expression
      if (!ts.isIdentifier(spreadExpr)) {
        throw new Error(`Unsupported spread expression in ${varName}: ${compact(spreadExpr.getText(decl.sourceFile))}`)
      }
      const spreadName = spreadExpr.text
      const spreadMap = evaluatePropsObject(spreadName, varDecls, [...stack, varName])
      for (const [key, value] of spreadMap.entries()) propsMap.set(key, value)
      continue
    }

    if (!ts.isPropertyAssignment(prop)) continue
    const name = getPropName(prop.name)
    if (!name) continue
    if (!ts.isObjectLiteralExpression(prop.initializer)) continue

    propsMap.set(name, {
      name,
      config: parsePropConfig(prop.initializer, decl.sourceFile),
    })
  }

  return propsMap
}

function buildVarDecls(sourceFiles) {
  const decls = new Map()
  for (const sourceFile of sourceFiles) {
    for (const statement of sourceFile.statements) {
      if (!ts.isVariableStatement(statement)) continue
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue
        if (!declaration.initializer) continue
        if (!ts.isObjectLiteralExpression(declaration.initializer)) continue
        decls.set(declaration.name.text, { sourceFile, objectLiteral: declaration.initializer })
      }
    }
  }
  return decls
}

function findTypeLikeDeclaration(sourceFile, typeName) {
  for (const statement of sourceFile.statements) {
    if (ts.isTypeAliasDeclaration(statement) && statement.name.text === typeName) return statement
    if (ts.isInterfaceDeclaration(statement) && statement.name.text === typeName) return statement
  }
  return null
}

function main() {
  const coreFile = parseSourceFile(INPUT_FILES.core)
  const draggableFile = parseSourceFile(INPUT_FILES.draggable)
  const sharedTypesFile = parseSourceFile(INPUT_FILES.sharedTypes)

  const varDecls = buildVarDecls([coreFile, draggableFile])

  const coreDefaultObj = findObjectInitializer(coreFile, 'draggableCoreDefaultProps')
  const coreObj = findObjectInitializer(coreFile, 'draggableCoreProps')
  const draggableObj = findObjectInitializer(draggableFile, 'draggableProps')

  const coreDefaultDirect = new Set(collectDirectPropNames(coreDefaultObj))
  const coreDirect = new Set(collectDirectPropNames(coreObj))
  const draggableDirect = new Set(collectDirectPropNames(draggableObj))

  const coreProps = evaluatePropsObject('draggableCoreProps', varDecls)
  const draggableProps = evaluatePropsObject('draggableProps', varDecls)

  const coreArray = []
  for (const [name, entry] of coreProps.entries()) {
    const definedIn = coreDirect.has(name)
      ? 'draggableCoreProps'
      : coreDefaultDirect.has(name)
        ? 'draggableCoreDefaultProps'
        : 'draggableCoreProps'
    coreArray.push({
      name,
      component: 'DraggableCore',
      definedIn,
      ...entry.config,
      source: { file: 'lib/DraggableCore.tsx' },
    })
  }

  const draggableArray = []
  for (const [name, entry] of draggableProps.entries()) {
    const inheritedFrom = draggableDirect.has(name) ? null : 'DraggableCore'
    const definedIn = draggableDirect.has(name)
      ? 'draggableProps'
      : coreDirect.has(name)
        ? 'draggableCoreProps'
        : coreDefaultDirect.has(name)
          ? 'draggableCoreDefaultProps'
          : 'draggableCoreProps'

    draggableArray.push({
      name,
      component: 'Draggable',
      inheritedFrom,
      definedIn,
      ...entry.config,
      source: { file: inheritedFrom ? 'lib/DraggableCore.tsx' : 'lib/Draggable.tsx' },
    })
  }

  const header = `/*\n * This file is generated by scripts/generate-props.js.\n * Do not edit manually.\n */\n\n`
  const types = `export type VueDraggableProp = {\n  name: string\n  component: 'Draggable' | 'DraggableCore'\n  inheritedFrom?: 'DraggableCore' | null\n  definedIn: 'draggableProps' | 'draggableCoreProps' | 'draggableCoreDefaultProps'\n  vueRuntimeTypes: string[]\n  tsType: string | null\n  sourceType: string | null\n  default: string | null\n  hasDefault: boolean\n  defaultIsFactory: boolean\n  required: boolean | null\n  validator: string | null\n  source: { file: string }\n  description: string\n}\n\n`

  const body = `export const DRAGGABLE_CORE_PROPS: VueDraggableProp[] = ${JSON.stringify(coreArray, null, 2)}\n\nexport const DRAGGABLE_PROPS: VueDraggableProp[] = ${JSON.stringify(draggableArray, null, 2)}\n`

  fs.writeFileSync(OUTPUT_FILE, header + types + body, 'utf8')
  console.log(`✅ Generated ${path.relative(root, OUTPUT_FILE)} (${coreArray.length} core props, ${draggableArray.length} draggable props)`)

  const typeTargets = [
    { name: 'Axis', source: sharedTypesFile },
    { name: 'DraggableBounds', source: sharedTypesFile },
    { name: 'ControlPosition', source: sharedTypesFile },
    { name: 'PositionOffsetControlPosition', source: sharedTypesFile },
    { name: 'DraggableEvent', source: sharedTypesFile },
    { name: 'DraggableData', source: sharedTypesFile },
    { name: 'AutoScrollContainerInput', source: coreFile },
    { name: 'AutoScrollContainerProp', source: coreFile },
  ]

  const typeDefs = {}
  for (const { name, source } of typeTargets) {
    const node = findTypeLikeDeclaration(source, name)
    if (!node) throw new Error(`Type not found: ${name} (in ${source.fileName})`)
    typeDefs[name] = node.getText(source).trim()
  }

  const typesHeader = `/*\n * This file is generated by scripts/generate-props.js.\n * Do not edit manually.\n */\n\n`
  const typesBody = `export const VUE_DRAGGABLE_TYPE_DEFS = ${JSON.stringify(typeDefs, null, 2)} as const\n\nexport type VueDraggableTypeName = keyof typeof VUE_DRAGGABLE_TYPE_DEFS\n`

  fs.writeFileSync(OUTPUT_TYPES_FILE, typesHeader + typesBody, 'utf8')
  console.log(`✅ Generated ${path.relative(root, OUTPUT_TYPES_FILE)} (${Object.keys(typeDefs).length} types)`)
}

main()
