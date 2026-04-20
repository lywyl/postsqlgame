import type { ExplainNode, ExplainResult } from '../types'

/**
 * 将 PostgreSQL EXPLAIN (FORMAT JSON) 的原始输出解析为自定义的树形结构
 */
export function parseExplain(rawJson: any[]): ExplainResult | null {
  if (!rawJson || !rawJson.length || !rawJson[0]['QUERY PLAN']) {
    return null
  }

  const queryPlan = rawJson[0]['QUERY PLAN'][0]
  const planTree = parseNode(queryPlan.Plan)

  return {
    plan: planTree,
    executionTime: queryPlan['Execution Time'],
    planningTime: queryPlan['Planning Time'],
    raw: rawJson
  }
}

function parseNode(rawNode: any): ExplainNode {
  const node: ExplainNode = {
    nodeType: rawNode['Node Type'],
    relationName: rawNode['Relation Name'],
    alias: rawNode['Alias'],
    startupCost: rawNode['Startup Cost'],
    totalCost: rawNode['Total Cost'],
    planRows: rawNode['Plan Rows'],
    actualRows: rawNode['Actual Rows'],
    actualLoops: rawNode['Actual Loops'],
    filter: rawNode['Filter'],
    indexCond: rawNode['Index Cond'],
    children: [],
    ...rawNode // 保留原始属性以便调试或后续使用
  }

  // 递归解析子节点
  if (rawNode.Plans && Array.isArray(rawNode.Plans)) {
    node.children = rawNode.Plans.map((p: any) => parseNode(p))
  }

  return node
}

/**
 * 遍历并寻找整棵执行计划树中的第一个包含 Scan 的节点。
 * （向后兼容，单表模式使用）
 */
export function findFirstScanNode(plan: ExplainNode): ExplainNode | null {
  if (plan.nodeType.includes('Scan')) {
    return plan
  }
  if (plan.children && plan.children.length > 0) {
    for (const child of plan.children) {
      const found = findFirstScanNode(child)
      if (found) return found
    }
  }
  return null
}

/**
 * 递归收集执行计划树中的所有 Scan 节点。
 */
export function findAllScanNodes(plan: ExplainNode): ExplainNode[] {
  const nodes: ExplainNode[] = []
  if (plan.nodeType.includes('Scan')) {
    nodes.push(plan)
  }
  if (plan.children && plan.children.length > 0) {
    for (const child of plan.children) {
      nodes.push(...findAllScanNodes(child))
    }
  }
  return nodes
}

/**
 * 从执行计划树中提取 JOIN 信息（策略、条件、类型）。
 * 返回 null 表示非 JOIN 查询。
 */
export interface JoinInfo {
  /** JOIN 策略: 'Nested Loop' | 'Hash Join' | 'Merge Join' */
  strategy: string
  /** JOIN 条件: ON 条件文本 */
  condition?: string
  /** 推导的 JOIN 类型: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL OUTER' | 'CROSS' */
  joinType?: string
}

export function extractJoinInfo(plan: ExplainNode): JoinInfo | null {
  // 查找第一个 Join 节点
  const joinNode = findJoinNode(plan)
  if (!joinNode) return null

  const strategy = joinNode.nodeType // 'Nested Loop' | 'Hash Join' | 'Merge Join'
  let condition: string | undefined

  // 尝试从不同字段提取 JOIN 条件
  condition = joinNode['Join Filter']
    || joinNode['Hash Cond']
    || joinNode['Merge Cond']
    || joinNode['Index Cond']
    || undefined

  // 推导 JOIN 类型
  const joinType = inferJoinType(joinNode)

  return { strategy, condition, joinType }
}

/**
 * 递归查找第一个 Join 节点。
 */
function findJoinNode(plan: ExplainNode): ExplainNode | null {
  if (plan.nodeType.includes('Join') || plan.nodeType === 'Nested Loop') {
    return plan
  }
  if (plan.children && plan.children.length > 0) {
    for (const child of plan.children) {
      const found = findJoinNode(child)
      if (found) return found
    }
  }
  return null
}

/**
 * 从 Join 节点推导 JOIN 类型。
 * PostgreSQL EXPLAIN 不直接报告 JOIN 类型，需要从节点结构推断。
 */
function inferJoinType(node: ExplainNode): string | undefined {
  // Hash Join / Merge Join 通常是 INNER JOIN，除非有 Outer Join 标记
  if (node['Join Type']) {
    const jt = node['Join Type'] as string
    if (jt === 'Left') return 'LEFT'
    if (jt === 'Right') return 'RIGHT'
    if (jt === 'Full') return 'FULL OUTER'
    if (jt === 'Inner') return 'INNER'
  }

  // Nested Loop 的情况下，从 Filter / Join Filter 推断
  // 如果有 Join Filter 且两个子节点都是 Scan → 通常是 INNER JOIN
  if (node.nodeType === 'Nested Loop') {
    if (node['Join Filter']) return 'INNER'
    // 如果内表有 Filter 且外表是 Seq Scan，可能是 LEFT JOIN
    // 这里保守返回 undefined，让 UI 层从 SQL 原文推断
  }

  return undefined
}
