import type { BTreeNode, BTreeSearchStep, BTreeData } from '../types'

const DEFAULT_DEGREE = 4 // 每个节点最多 degree-1 个 key, degree 个子指针

let nodeCounter = 0

function makeNodeId(): string {
  return `node-${nodeCounter++}`
}

/**
 * 从有序的 key 数组自底向上构建一棵 B+ Tree。
 * 
 * 算法：
 * 1. 将排好序的 keys 均匀分配到叶子节点中（每个叶子最多容纳 degree-1 个 key）。
 * 2. 从叶子层开始，逐层向上构建内部节点，每个内部节点最多拥有 degree 个子节点。
 * 3. 内部节点的 keys 取自其子节点的「分界 key」（每个子节点的第一个 key）。
 * 4. 重复直至只剩一个根节点。
 */
export function buildBTree(rawKeys: (number | string)[], degree: number = DEFAULT_DEGREE): BTreeNode {
  nodeCounter = 0

  // 去重 + 排序
  const uniqueKeys = [...new Set(rawKeys)]
  uniqueKeys.sort((a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return a - b
    return String(a).localeCompare(String(b))
  })

  if (uniqueKeys.length === 0) {
    return { id: makeNodeId(), keys: [], isLeaf: true, children: [] }
  }

  const maxKeysPerNode = degree - 1

  // 第一步：构建叶子层
  const leaves: BTreeNode[] = []
  for (let i = 0; i < uniqueKeys.length; i += maxKeysPerNode) {
    const chunk = uniqueKeys.slice(i, i + maxKeysPerNode)
    leaves.push({
      id: makeNodeId(),
      keys: chunk,
      isLeaf: true,
      children: []
    })
  }

  // 第二步：自底向上逐层构建内部节点
  let currentLevel = leaves

  while (currentLevel.length > 1) {
    const parentLevel: BTreeNode[] = []

    for (let i = 0; i < currentLevel.length; i += degree) {
      const childGroup = currentLevel.slice(i, i + degree)

      // 内部节点的 keys 来自第 2 个起的每个子节点的第一个 key（分界值）
      const parentKeys: (number | string)[] = []
      for (let j = 1; j < childGroup.length; j++) {
        parentKeys.push(childGroup[j].keys[0])
      }

      parentLevel.push({
        id: makeNodeId(),
        keys: parentKeys,
        isLeaf: false,
        children: childGroup
      })
    }

    currentLevel = parentLevel
  }

  return currentLevel[0]
}

/**
 * 在 B+ Tree 中搜索 key，返回搜索路径的每一步。
 * 
 * 对于每个节点：
 * 1. 进入节点（enter）
 * 2. 从左到右逐个比较 key
 * 3. 如果找到匹配，记录 match
 * 4. 如果没找到，确定走向哪个子节点（left/right）
 * 5. 递归进入子节点
 */
export function searchBTree(
  root: BTreeNode,
  searchKey: number | string
): BTreeSearchStep[] {
  const path: BTreeSearchStep[] = []
  searchInNode(root, searchKey, path)
  return path
}

function searchInNode(
  node: BTreeNode,
  searchKey: number | string,
  path: BTreeSearchStep[]
): void {
  // 步骤 1：进入此节点
  path.push({
    nodeId: node.id,
    keyIndex: -1,
    found: false,
    direction: 'enter'
  })

  // 步骤 2：在节点内逐 key 比较
  let childIndex = node.keys.length // 默认走最右边的子节点

  for (let i = 0; i < node.keys.length; i++) {
    const cmp = compareKeys(searchKey, node.keys[i])

    if (cmp === 0) {
      // 精准匹配
      path.push({
        nodeId: node.id,
        keyIndex: i,
        found: true,
        direction: 'match'
      })

      // 如果是叶子节点，搜索结束；
      // 如果是内部节点，继续向下走到对应子树
      if (node.isLeaf) {
        return
      }
      // 在内部节点找到匹配 key，走右子树继续寻找叶子
      childIndex = i + 1
      break
    } else if (cmp < 0) {
      // searchKey < 当前 key → 走左侧子树
      path.push({
        nodeId: node.id,
        keyIndex: i,
        found: false,
        direction: 'left'
      })
      childIndex = i
      break
    } else {
      // searchKey > 当前 key → 继续比较下一个 key，或走右侧
      path.push({
        nodeId: node.id,
        keyIndex: i,
        found: false,
        direction: 'right'
      })
    }
  }

  // 步骤 3：如果是叶子但没找到
  if (node.isLeaf) {
    return
  }

  // 步骤 4：递归进入子节点
  if (childIndex < node.children.length) {
    searchInNode(node.children[childIndex], searchKey, path)
  }
}

function compareKeys(a: number | string, b: number | string): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

/**
 * 从 ExplainNode 的 indexCond 中提取搜索键值。
 * 支持: "(id = 5)", "(id > 3)", "(name = '张三')"
 * 对于范围查询（>, <, >=, <=），取值作为搜索起点。
 * 如果无法解析，返回 null。
 */
export function parseIndexCond(indexCond: string): { column: string; value: number | string } | null {
  // 匹配形如 (column op value) 的模式，op 支持 =, >, <, >=, <=
  const match = indexCond.match(/\((\w+)\s*(>=|<=|>|<|=)\s*(.+?)\)/)
  if (!match) return null

  const column = match[1]
  // const operator = match[2]  // 运算符，暂不用于 B+ Tree 搜索路径构建
  let value: number | string = match[3].trim()

  // 去掉引号（字符串值）
  if ((value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))) {
    value = value.slice(1, -1)
  } else {
    // 尝试转为数字
    const num = Number(value)
    if (!isNaN(num)) {
      value = num
    }
  }

  return { column, value }
}

/**
 * 一站式：从表数据 + 索引条件 构建 BTreeData（树 + 搜索路径）
 */
export function buildBTreeData(
  rows: Record<string, unknown>[],
  indexCond: string,
  degree: number = DEFAULT_DEGREE
): BTreeData | null {
  const parsed = parseIndexCond(indexCond)
  if (!parsed) return null

  const { column, value } = parsed
  return buildBTreeFromColumn(rows, column, value, degree)
}

/**
 * 直接从列名 + 搜索值构建 BTreeData。
 * 适用于 PGlite 优化器在小表上跳过索引但用户确实创建了索引的场景。
 */
export function buildBTreeFromColumn(
  rows: Record<string, unknown>[],
  column: string,
  searchValue: number | string,
  degree: number = DEFAULT_DEGREE
): BTreeData | null {
  // 从表数据提取该列所有的值作为 keys
  const keys: (number | string)[] = []
  for (const row of rows) {
    const v = row[column]
    if (v !== null && v !== undefined) {
      keys.push(typeof v === 'number' ? v : String(v))
    }
  }

  if (keys.length === 0) return null

  const root = buildBTree(keys, degree)
  const searchPath = searchBTree(root, searchValue)

  return {
    root,
    searchKey: searchValue,
    searchPath,
    indexColumn: column
  }
}

/**
 * 从 SQL 的 WHERE 子句中尝试提取等值条件的列名和值。
 * 例如: "SELECT * FROM t WHERE id = 3" -> { column: 'id', value: 3 }
 *       "SELECT * FROM t WHERE name = '张三'" -> { column: 'name', value: '张三' }
 */
export function parseWhereCondition(sql: string): { column: string; value: number | string } | null {
  // 先提取 WHERE 到下一个主要关键字之间的子句，避免匹配字符串内容中的 WHERE
  // 终止词：AND, OR, ORDER, GROUP, HAVING, LIMIT, OFFSET, UNION, INTERSECT, EXCEPT, JOIN, INNER, LEFT, RIGHT, FULL, CROSS, NATURAL, ON, USING, ), ;
  const whereClause = sql.match(/\bWHERE\b(.+?)(?:\b(?:AND|OR|ORDER|GROUP|HAVING|LIMIT|OFFSET|UNION|INTERSECT|EXCEPT|JOIN|INNER|LEFT|RIGHT|FULL|CROSS|NATURAL|ON|USING)\b|[);])/is)
  if (!whereClause) return null

  // 从 WHERE 子句中提取第一个 column = value 条件
  const match = whereClause[1].match(/(?:^|[\s(])(?:\w+\.)?(\w+)\s*=\s*(.+?)$/s)
  if (!match) return null

  const column = match[1]
  let value: number | string = match[2].trim()

  // 去掉引号
  if ((value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))) {
    value = value.slice(1, -1)
  } else {
    const num = Number(value)
    if (!isNaN(num)) {
      value = num
    }
  }

  return { column, value }
}
