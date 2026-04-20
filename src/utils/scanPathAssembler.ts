import type { ExplainNode, ScanPathData, ScanTable, QueryResult } from '../types'
import { findAllScanNodes, extractJoinInfo } from './explainParser'

/**
 * 从 EXPLAIN 计划树组装 ScanPathData。
 *
 * - 单表查询: tables.length = 1, role = 'single'
 * - JOIN 查询: tables.length >= 2, 按外表/内表标记 role
 * - CROSS JOIN: 特殊处理，joinType = 'Cross Join'
 *
 * @param plan EXPLAIN 解析后的计划树
 * @param getTableData 获取表数据的函数（由 db store 注入）
 */
export async function assembleScanPathData(
  plan: ExplainNode,
  getTableData: (tableName: string) => Promise<QueryResult>
): Promise<ScanPathData | null> {
  // 收集所有 Scan 节点
  const scanNodes = findAllScanNodes(plan)
  if (scanNodes.length === 0) return null

  // 提取 JOIN 信息
  const joinInfo = extractJoinInfo(plan)

  // 并发获取所有表数据
  const tablePromises = scanNodes.map(async (node) => {
    const tableName = node.relationName
    if (!tableName) return null

    const tableData = await getTableData(tableName)
    return {
      node,
      tableData,
      alias: node.alias || tableName,
      tableName,
    }
  })

  const tableResults = (await Promise.all(tablePromises)).filter(Boolean) as {
    node: ExplainNode
    tableData: QueryResult
    alias: string
    tableName: string
  }[]

  if (tableResults.length === 0) return null

  // 判断是否为 CROSS JOIN
  const isCrossJoin = plan.nodeType === 'Nested Loop'
    && !plan['Join Filter']
    && !plan['Hash Cond']
    && !plan['Merge Cond']
    && !plan['Index Cond']
    && scanNodes.length >= 2

  // 构建 ScanTable 数组
  const tables: ScanTable[] = tableResults.map((result, index) => {
    let role: ScanTable['role']
    if (tableResults.length === 1) {
      role = 'single'
    } else if (index === 0) {
      role = 'outer'  // 第一个 Scan 节点是外表（驱动表）
    } else {
      role = 'inner'  // 后续是内表（被驱动表）
    }

    return {
      node: result.node,
      tableData: result.tableData,
      alias: result.alias,
      role,
    }
  })

  // 向后兼容：单表模式下填充 node / tableData
  const firstTable = tables[0]

  // joinType: 推断的 JOIN 类型 (LEFT/RIGHT/FULL OUTER/INNER/Cross Join)
  // joinStrategy: 执行策略 (Nested Loop/Hash Join/Merge Join)
  let resolvedJoinType: string | undefined
  let joinStrategy: string | undefined
  if (isCrossJoin) {
    resolvedJoinType = 'Cross Join'
  } else if (joinInfo) {
    resolvedJoinType = joinInfo.joinType || undefined
    joinStrategy = joinInfo.strategy || undefined
  }

  return {
    tables,
    joinType: resolvedJoinType,
    joinStrategy,
    joinCondition: joinInfo?.condition,
    node: firstTable.node,
    tableData: firstTable.tableData,
  }
}
