/** 关卡中的单个任务 */
export interface LevelTask {
  prompt: string        // 剧情台词 + 任务描述
  answerSql: string     // 标准答案 SQL
  checkSql?: string     // DML操作(如UPDATE)验证时使用的状态检查 SQL，如果存在则开启事务验证模式
  hints: string[]       // 三级提示
  successStory?: string // 任务执行成功后的后续剧情推进与反馈（必须点击继续）
  /** 标记此任务的 answerSql 包含事务控制/多语句/CHECKPOINT，需要特殊处理 */
  needsTransaction?: boolean
}

/** 关卡数据结构 */
export interface Level {
  id: string
  title: string
  description: string       // 关卡剧情概述
  initSql: string
  tasks: LevelTask[]        // 多任务
  defaultSql?: string       // 编辑器预填 SQL
  /** MVCC 教学剧本（可选） */
  mvccScenario?: MvccScenario
}

/** 章节数据结构 */
export interface Chapter {
  id: string
  title: string
  description: string
  icon: string
  levels: Level[]
}

/** 查询结果 */
export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
  duration: number
}

/** 关卡进度 */
export interface LevelProgress {
  chapterId: string
  levelId: string
  completed: boolean
  stars: number
  hintsUsed: number
}

/** 游戏存档 */
export interface GameProgress {
  exp: number
  level: number
  completedLevels: LevelProgress[]
  achievements: string[]
  /** 存档版本号，用于检测旧版本并自动清理 */
  progressVersion?: number
}

/** 成就定义 */
export interface Achievement {
  id: string
  icon: string
  title: string
  description: string
}

/** 
 * 可视化面板类型 
 */
export type VisualTab = 'scan' | 'btree' | 'mvcc' | 'explain'

export interface ExplainNode {
  nodeType: string
  relationName?: string
  alias?: string
  startupCost: number
  totalCost: number
  planRows: number
  actualRows?: number
  actualLoops?: number
  filter?: string
  indexCond?: string
  children: ExplainNode[]
  [key: string]: any // for other raw props
}

export interface ExplainResult {
  plan: ExplainNode
  executionTime?: number
  planningTime?: number
  raw?: any
}

// 扫描路径类型 (Step 3.5 — 多表 JOIN 支持)
/** 单张表的扫描数据 */
export interface ScanTable {
  node: ExplainNode        // 该表对应的 Scan 节点
  tableData: QueryResult   // 该表的完整行数据
  alias?: string           // SQL 别名（Self-JOIN 区分用）
  role: 'outer' | 'inner' | 'single'  // 驱动表/被驱动表/单表
  nullPaddedRows?: number  // 外连接中 NULL 填充的行数
}

/** 扫描路径可视化数据 */
export interface ScanPathData {
  tables: ScanTable[]              // 多表（单表时 length=1）
  joinType?: string                // 'LEFT' | 'RIGHT' | 'FULL OUTER' | 'INNER' | 'Cross Join' | undefined
  joinStrategy?: string            // 'Nested Loop' | 'Hash Join' | 'Merge Join' | undefined
  joinCondition?: string           // ON 条件文本
  /** 向后兼容：单表模式下指向唯一的 table */
  node: ExplainNode
  tableData: QueryResult
}
// B+ Tree 可视化类型 (Step 4)
export interface BTreeNode {
  id: string
  keys: (number | string)[]
  isLeaf: boolean
  children: BTreeNode[]
}

/** 搜索路径中的一步 */
export interface BTreeSearchStep {
  nodeId: string
  keyIndex: number       // 在该节点中比较到的 key 位置（-1 表示整个节点高亮）
  found: boolean         // 是否在此节点找到了目标
  direction: 'left' | 'right' | 'match' | 'enter'  // 搜索方向
}

export interface BTreeData {
  root: BTreeNode
  searchKey: number | string | null
  searchPath: BTreeSearchStep[]
  indexColumn: string
}
/** MVCC 剧本中的单步操作 */
export interface MvccOperation {
  op: 'INSERT' | 'UPDATE' | 'DELETE' | 'VACUUM'
  /** INSERT: 新行数据；UPDATE: 更新后的部分字段 */
  data?: Record<string, unknown>
  /** UPDATE/DELETE: 目标行的定位条件，如 { id: 3 } */
  target?: Record<string, unknown>
  /** 该步骤的教学解说文本 */
  explanation: string
}

/** 关卡数据中的 MVCC 剧本定义 */
export interface MvccScenario {
  tableName: string
  /** 初始表数据（必须是 initSql 中 INSERT 数据的严格子集） */
  initialRows: Record<string, unknown>[]
  /** 列名列表（控制显示顺序） */
  columns: string[]
  /** 操作序列——状态机的输入 */
  operations: MvccOperation[]
}

/** 某一时刻的单个元组版本 */
export interface MvccTupleVersion {
  ctid: string
  row: Record<string, unknown>
  xmin: number
  xmax: number
  status: 'live' | 'dead' | 'vacuumed'
}

/** 状态机输出的单步快照 */
export interface MvccSnapshot {
  stepIndex: number
  xid: number
  operation: MvccOperation
  tuples: MvccTupleVersion[]
  changedCtids: string[]
}

/** 完整的 MVCC 可视化数据 */
export interface MvccData {
  tableName: string
  columns: string[]
  snapshots: MvccSnapshot[]
  realSystemColumns: {
    ctid: string
    xmin: number
    xmax: number
    row: Record<string, unknown>
  }[] | null
}

/** 教学化错误信息（翻译后 + 原始） */
export interface SqlDisplayError {
  /** 教学化中文提示 */
  friendlyMessage: string
  /** 原始 PGlite 错误信息 */
  rawMessage: string
  /** 匹配到的规则 key */
  ruleKey: string
}

/** SQL 执行历史条目 */
export interface SqlExecutionHistoryItem {
  id: string
  sql: string
  timestamp: number
  success: boolean
  /** 错误摘要（成功时为空） */
  errorSummary?: string
}
