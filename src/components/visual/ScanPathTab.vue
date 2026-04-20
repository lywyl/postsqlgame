<script setup lang="ts">
import { computed, watch, onUnmounted, ref, nextTick } from 'vue'
import { useVisualStore } from '../../stores/visual'
import AnimationControls from './controls/AnimationControls.vue'

const visual = useVisualStore()

const scanData = computed(() => visual.scanPathData)

// Multi-table mode detection
const isMultiTable = computed(() => (scanData.value?.tables?.length ?? 0) >= 2)
const isCrossJoin = computed(() => scanData.value?.joinType === 'Cross Join')
const tables = computed(() => scanData.value?.tables ?? [])

// ==================== Nested Loop State Machine ====================

type NestedLoopPhase = 'idle' | 'scanning-outer' | 'scanning-inner' | 'match' | 'no-match' | 'finished'

interface NestedLoopState {
  outerRow: number
  innerRow: number
  phase: NestedLoopPhase
  matchedRows: Array<{ outer: Record<string, unknown> | null, inner: Record<string, unknown> | null }>
  isPlaying: boolean
  currentStep: number
  totalSteps: number
  speed: number
  matchFlashTimer: number | null
  joinType: string // 'INNER' | 'LEFT' | 'RIGHT' | 'FULL OUTER' | 'Cross Join' | strategy name
}

// Performance boundary
const MAX_ANIMATION_STEPS = 100
const BASE_STEP_DURATION = 800 // ms

// ==================== Smart Animation Rhythm ====================
// 教学优先：前几行慢速演示，匹配行停顿强调，非匹配行快速闪过

const SLOW_ROWS_COUNT = 3 // 前3行慢速演示
const SLOW_DURATION = 800 // 慢速：800ms/行
const MATCH_DURATION = 600 // 匹配行停顿：600ms
const FAST_DURATION = 100 // 非匹配行快速：100ms
const NORMAL_DURATION = 300 // 默认：300ms

/**
 * 智能计算当前步骤的动画时长
 * @param rowIndex 当前行索引
 * @param isMatch 当前行是否匹配
 * @param hasFilter 是否有WHERE过滤条件
 */
function getSmartStepDuration(rowIndex: number, isMatch: boolean, hasFilter: boolean): number {
  // 前N行：慢速演示，让用户看清"逐行扫描"原理
  if (rowIndex < SLOW_ROWS_COUNT) {
    return SLOW_DURATION
  }
  
  // 有WHERE条件时，区分匹配/不匹配
  if (hasFilter) {
    // 匹配行：停顿强调，这是教学重点！
    if (isMatch) {
      return MATCH_DURATION
    }
    // 非匹配行：快速闪过，不浪费时间
    return FAST_DURATION
  }
  
  // 无WHERE条件：中等速度
  return NORMAL_DURATION
}

/**
 * 获取当前行是否匹配（用于智能节奏计算）
 */
function getCurrentRowIsMatch(rowIndex: number): boolean {
  // 使用预计算的结果，避免重复计算
  const precomputed = precomputedSingleRowStatuses.value[rowIndex]
  return precomputed?.isMatch ?? false
}

// Nested Loop state (used when joinType is 'Nested Loop' or similar)
const nestedLoopState = ref<NestedLoopState>({
  outerRow: 0,
  innerRow: 0,
  phase: 'idle',
  matchedRows: [],
  isPlaying: false,
  currentStep: 0,
  totalSteps: 0,
  speed: 1,
  matchFlashTimer: null,
  joinType: 'INNER'
})

// Derived JOIN type flags
const isLeftJoin = computed(() => {
  const jt = nestedLoopState.value.joinType
  return jt === 'LEFT' || jt?.includes('Left')
})
const isRightJoin = computed(() => {
  const jt = nestedLoopState.value.joinType
  return jt === 'RIGHT' || jt?.includes('Right')
})
const isFullJoin = computed(() => {
  const jt = nestedLoopState.value.joinType
  return jt === 'FULL OUTER' || jt?.includes('Full')
})

// Detect if this is a nested loop join (vs Hash Join, Merge Join)
const isNestedLoopJoin = computed(() => {
  if (!isMultiTable.value || isCrossJoin.value) return false
  const strategy = scanData.value?.joinStrategy
  if (!strategy) return false
  return strategy === 'Nested Loop' || strategy.includes('Nested')
})

// Speed notice for large datasets
const showSpeedNotice = computed(() => {
  if (!isNestedLoopJoin.value) return false
  return nestedLoopState.value.totalSteps > MAX_ANIMATION_STEPS
})

// ==================== Join Condition Parser ====================

interface JoinConditionMatcher {
  outerColumn: string
  innerColumn: string
  outerTableAlias: string
  innerTableAlias: string
}

function parseJoinCondition(condition: string, outerAlias: string, innerAlias: string): JoinConditionMatcher | null {
  if (!condition) return null
  
  // Parse patterns like: "c.district_id = d.id" or "citizens.salary > departments.max_salary"
  const eqMatch = condition.match(/\s*=\s*/)
  if (!eqMatch) return null
  
  const parts = condition.split('=')
  if (parts.length !== 2) return null
  
  const leftExpr = parts[0].trim()
  const rightExpr = parts[1].trim()
  
  // Extract table.column from each side
  const leftParts = leftExpr.split('.')
  const rightParts = rightExpr.split('.')
  
  if (leftParts.length !== 2 || rightParts.length !== 2) {
    // Might be simple column names without prefix
    return {
      outerColumn: leftParts.length === 1 ? leftExpr : leftParts[1],
      innerColumn: rightParts.length === 1 ? rightExpr : rightParts[1],
      outerTableAlias: outerAlias,
      innerTableAlias: innerAlias
    }
  }
  
  // Determine which side is outer/inner based on alias matching
  const leftAlias = leftParts[0]
  
  // Match aliases (could be table name or SQL alias)
  const outerTable = tables.value[0]
  const innerTable = tables.value[1]
  
  const leftMatchesOuter = leftAlias === outerAlias || leftAlias === outerTable?.node?.relationName
  const leftMatchesInner = leftAlias === innerAlias || leftAlias === innerTable?.node?.relationName
  
  if (leftMatchesOuter) {
    return {
      outerColumn: leftParts[1],
      innerColumn: rightParts[1],
      outerTableAlias: outerAlias,
      innerTableAlias: innerAlias
    }
  } else if (leftMatchesInner) {
    // Swap: left is inner, right is outer
    return {
      outerColumn: rightParts[1],
      innerColumn: leftParts[1],
      outerTableAlias: outerAlias,
      innerTableAlias: innerAlias
    }
  }
  
  // Fallback: use column existence check
  const outerColumns = outerTable?.tableData?.columns ?? []
  const innerColumns = innerTable?.tableData?.columns ?? []
  
  if (outerColumns.includes(leftParts[1]) && innerColumns.includes(rightParts[1])) {
    return {
      outerColumn: leftParts[1],
      innerColumn: rightParts[1],
      outerTableAlias: outerAlias,
      innerTableAlias: innerAlias
    }
  } else if (outerColumns.includes(rightParts[1]) && innerColumns.includes(leftParts[1])) {
    return {
      outerColumn: rightParts[1],
      innerColumn: leftParts[1],
      outerTableAlias: outerAlias,
      innerTableAlias: innerAlias
    }
  }
  
  return null
}

function createJoinEvaluator(matcher: JoinConditionMatcher): (outerRow: Record<string, unknown>, innerRow: Record<string, unknown>) => boolean {
  return (outerRow, innerRow) => {
    const outerVal = outerRow[matcher.outerColumn]
    const innerVal = innerRow[matcher.innerColumn]
    // Compare values (handle type differences)
    if (outerVal === null || outerVal === undefined || innerVal === null || innerVal === undefined) {
      return false
    }
    return outerVal == innerVal
  }
}

// ==================== End Join Condition Parser ====================

// Per-table animation state (independent animations)
const tableAnimStates = ref<Map<number, {
  isPlaying: boolean
  currentStep: number
  totalSteps: number
  speed: number
}>>(new Map())

// Single-table mode uses these (backward compatible)
const singleIsPlaying = ref(false)
const singleCurrentStep = ref(0)
const singleTotalSteps = ref(0)
const singleSpeed = ref(1)

// ==================== Filter Parser ====================

// Enhanced filter parser using regex-based approach for more reliability
function createFilterEvaluator(filter: string, _columns: string[]): (row: Record<string, unknown>) => boolean {
  try {
    // Normalize the filter string
    let normalized = filter
      // Remove type casts
      .replace(/::[\w]+(\[\])?/g, '')
      // Remove table prefix from columns
      .replace(/\b[\w]+\./g, '')
      .trim()
    
    // Remove outer parentheses if balanced
    while (normalized.startsWith('(') && normalized.endsWith(')')) {
      let depth = 0
      let balanced = true
      for (let i = 0; i < normalized.length; i++) {
        if (normalized[i] === '(') depth++
        else if (normalized[i] === ')') depth--
        if (depth === 0 && i < normalized.length - 1) {
          balanced = false
          break
        }
      }
      if (balanced) {
        normalized = normalized.slice(1, -1).trim()
      } else {
        break
      }
    }
    
    return (row: Record<string, unknown>) => evaluateCondition(normalized, row)
  } catch {
    return () => true
  }
}

function evaluateCondition(condition: string, row: Record<string, unknown>): boolean {
  // Handle OR first (lower precedence)
  const orParts = splitByOperator(condition, ' OR ')
  if (orParts.length > 1) {
    return orParts.some(part => evaluateCondition(part, row))
  }
  
  // Handle AND (higher precedence)
  const andParts = splitByOperator(condition, ' AND ')
  if (andParts.length > 1) {
    return andParts.every(part => evaluateCondition(part, row))
  }
  
  // Handle parentheses
  if (condition.startsWith('(') && condition.endsWith(')')) {
    return evaluateCondition(condition.slice(1, -1).trim(), row)
  }
  
  // Handle IS NULL / IS NOT NULL
  if (/\bIS\s+NULL\b/i.test(condition)) {
    const col = condition.split(/\s+IS\s+NULL\b/i)[0].trim()
    return row[col] === null || row[col] === undefined
  }
  if (/\bIS\s+NOT\s+NULL\b/i.test(condition)) {
    const col = condition.split(/\s+IS\s+NOT\s+NULL\b/i)[0].trim()
    return row[col] !== null && row[col] !== undefined
  }
  
  // Handle LIKE
  const likeMatch = condition.match(/^(.+?)\s+LIKE\s+'(.+)'$/i)
  if (likeMatch) {
    const col = likeMatch[1].trim()
    const pattern = likeMatch[2]
    const value = String(row[col] ?? '')
    // Convert SQL LIKE pattern to regex
    const regexPattern = pattern
      .replace(/%/g, '.*')
      .replace(/_/g, '.')
    return new RegExp(`^${regexPattern}$`, 'i').test(value)
  }
  
  // Handle comparison operators
  const compMatch = condition.match(/^(.+?)\s*(<>|<=|>=|<|>|=)\s*(.+)$/)
  if (compMatch) {
    const col = compMatch[1].trim()
    const op = compMatch[2]
    let val = compMatch[3].trim()
    
    // Parse value
    let parsedVal: unknown
    if (val.startsWith("'") && val.endsWith("'")) {
      parsedVal = val.slice(1, -1)
    } else if (val === 'NULL' || val === 'null') {
      parsedVal = null
    } else if (/^-?\d+$/.test(val)) {
      parsedVal = parseInt(val, 10)
    } else if (/^-?\d+\.\d+$/.test(val)) {
      parsedVal = parseFloat(val)
    } else {
      // Might be a column reference
      parsedVal = row[val]
    }
    
    const colVal = row[col]
    
    switch (op) {
      case '=':
        return colVal == parsedVal
      case '<>':
        return colVal != parsedVal
      case '<':
        return colVal != null && parsedVal != null && colVal < parsedVal
      case '>':
        return colVal != null && parsedVal != null && colVal > parsedVal
      case '<=':
        return colVal != null && parsedVal != null && colVal <= parsedVal
      case '>=':
        return colVal != null && parsedVal != null && colVal >= parsedVal
    }
  }
  
  // Fallback: cannot parse, return true
  return true
}

function splitByOperator(str: string, op: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  let i = 0
  
  while (i < str.length) {
    if (str[i] === '(') depth++
    else if (str[i] === ')') depth--
    
    if (depth === 0 && str.slice(i).toUpperCase().startsWith(op)) {
      parts.push(current.trim())
      current = ''
      i += op.length
      continue
    }
    
    current += str[i]
    i++
  }
  
  if (current.trim()) {
    parts.push(current.trim())
  }
  
  return parts.length > 1 ? parts : [str]
}

// Cache for filter evaluators to avoid recreating
const filterEvaluatorCache = new Map<string, (row: Record<string, unknown>) => boolean>()

function getFilterEvaluator(filter: string, columns: string[]): (row: Record<string, unknown>) => boolean {
  const cacheKey = `${filter}|${columns.join(',')}`
  if (!filterEvaluatorCache.has(cacheKey)) {
    filterEvaluatorCache.set(cacheKey, createFilterEvaluator(filter, columns))
  }
  return filterEvaluatorCache.get(cacheKey)!
}

// ==================== Pre-computed Row Status Cache ====================
// 预计算所有行的过滤结果，避免每帧重复计算

interface PrecomputedRowStatus {
  index: number
  isMatch: boolean // 是否匹配WHERE条件
  group: 'fast' | 'slow' // 动画分组：fast=非匹配快速闪过，slow=匹配停顿强调
}

// 单表模式预计算
const precomputedSingleRowStatuses = computed<PrecomputedRowStatus[]>(() => {
  if (!scanData.value || isMultiTable.value) return []
  
  const tableData = scanData.value.tableData
  const hasFilter = !!scanData.value.node?.filter
  
  if (!hasFilter || !tableData) {
    // 无过滤器：所有行都按正常速度
    return (tableData?.rows ?? []).map((_, index) => ({
      index,
      isMatch: true,
      group: 'slow' as const
    }))
  }
  
  try {
    const evaluator = getFilterEvaluator(scanData.value.node!.filter!, tableData.columns)
    return tableData.rows.map((row, index) => {
      const match = evaluator(row)
      return {
        index,
        isMatch: match,
        group: match ? 'slow' : 'fast'
      }
    })
  } catch {
    // 出错时返回默认状态
    return tableData.rows.map((_, index) => ({
      index,
      isMatch: true,
      group: 'slow' as const
    }))
  }
})

// 多表模式预计算（每个表独立）
const precomputedMultiRowStatuses = computed<Map<number, PrecomputedRowStatus[]>>(() => {
  const result = new Map<number, PrecomputedRowStatus[]>()
  
  tables.value.forEach((table, tableIndex) => {
    const hasFilter = !!table.node?.filter
    const tableData = table.tableData
    
    if (!hasFilter || !tableData) {
      result.set(tableIndex, (tableData?.rows ?? []).map((_, index) => ({
        index,
        isMatch: true,
        group: 'slow' as const
      })))
      return
    }
    
    try {
      const evaluator = getFilterEvaluator(table.node.filter!, tableData.columns)
      result.set(tableIndex, tableData.rows.map((row, index) => {
        const match = evaluator(row)
        return {
          index,
          isMatch: match,
          group: match ? 'slow' : 'fast'
        }
      }))
    } catch {
      result.set(tableIndex, tableData.rows.map((_, index) => ({
        index,
        isMatch: true,
        group: 'slow' as const
      })))
    }
  })
  
  return result
})

// ==================== End Filter Parser ====================

// ==================== Nested Loop Animation ====================

let nestedLoopFrame: number | null = null
let nestedLoopLastTime = 0
let joinEvaluator: ((outer: Record<string, unknown>, inner: Record<string, unknown>) => boolean) | null = null

// Reference to result panel for auto-scroll
const resultPanelRef = ref<HTMLElement | null>(null)

// Snapshot-based undo: store state at each step for O(1) backward navigation
const MAX_SNAPSHOTS = 50 // 限制最大快照数量，防止内存泄漏
let stepSnapshots: Array<{
  outerRow: number
  innerRow: number
  phase: NestedLoopPhase
  matchedRows: Array<{ outer: Record<string, unknown> | null, inner: Record<string, unknown> | null }>
  matchedInnerIndices: Set<number>
}> = []

function initNestedLoopState() {
  const outerTable = tables.value[0]
  const innerTable = tables.value[1]
  
  if (!outerTable || !innerTable) return
  
  const outerRows = outerTable.tableData.rows?.length ?? 0
  const innerRows = innerTable.tableData.rows?.length ?? 0
  const joinType = scanData.value?.joinType ?? ''
  
  // Parse join condition
  const outerAlias = outerTable.alias || outerTable.node.relationName || ''
  const innerAlias = innerTable.alias || innerTable.node.relationName || ''
  const matcher = parseJoinCondition(scanData.value?.joinCondition || '', outerAlias, innerAlias)
  
  if (matcher) {
    joinEvaluator = createJoinEvaluator(matcher)
  }
  
  // Calculate total steps (each outer row + all inner comparisons)
  const totalSteps = outerRows * (innerRows + 1)
  
  // Calculate speed multiplier for large datasets
  let speed = 1
  if (totalSteps > MAX_ANIMATION_STEPS) {
    speed = totalSteps / MAX_ANIMATION_STEPS
  }
  
  // Reset snapshots
  stepSnapshots = []
  
  nestedLoopState.value = {
    outerRow: 0,
    innerRow: 0,
    phase: 'idle',
    matchedRows: [],
    isPlaying: false,
    currentStep: 0,
    totalSteps,
    speed,
    matchFlashTimer: null,
    joinType: joinType || 'INNER'
  }
}

function nestedLoopLoop(time: number) {
  if (!nestedLoopState.value.isPlaying) {
    nestedLoopFrame = requestAnimationFrame(nestedLoopLoop)
    return
  }
  
  const state = nestedLoopState.value
  const effectiveDuration = BASE_STEP_DURATION / state.speed
  
  if (time - nestedLoopLastTime > effectiveDuration) {
    advanceNestedLoop()
    nestedLoopLastTime = time
  }
  
  nestedLoopFrame = requestAnimationFrame(nestedLoopLoop)
}

function advanceNestedLoop() {
  const state = nestedLoopState.value
  const outerTable = tables.value[0]
  const innerTable = tables.value[1]
  
  if (!outerTable || !innerTable) return

  // Save snapshot before advancing (for O(1) backward navigation)
  stepSnapshots.push({
    outerRow: state.outerRow,
    innerRow: state.innerRow,
    phase: state.phase,
    matchedRows: [...state.matchedRows],
    matchedInnerIndices: new Set(), // rebuild not needed for backward
  })
  
  // 限制快照数量，防止内存泄漏
  if (stepSnapshots.length > MAX_SNAPSHOTS) {
    stepSnapshots.shift() // 移除最旧的快照
  }
  
  const outerRows = outerTable.tableData.rows ?? []
  const innerRows = innerTable.tableData.rows ?? []
  
  switch (state.phase) {
    case 'idle':
    case 'scanning-outer':
      // Start scanning next outer row
      if (state.outerRow >= outerRows.length) {
        // RIGHT/FULL JOIN: after outer scan completes, add NULL outer rows
        // for inner rows that never matched any outer row
        if (isRightJoin.value || isFullJoin.value) {
          const matchedInnerIndices = new Set<number>()
          for (const mr of state.matchedRows) {
            if (mr.inner !== null) {
              const idx = innerRows.indexOf(mr.inner as Record<string, unknown>)
              if (idx >= 0) matchedInnerIndices.add(idx)
            }
          }
          for (let i = 0; i < innerRows.length; i++) {
            if (!matchedInnerIndices.has(i)) {
              state.matchedRows.push({
                outer: null,
                inner: innerRows[i]
              })
            }
          }
        }
        state.phase = 'finished'
        state.isPlaying = false
        return
      }
      state.phase = 'scanning-inner'
      state.innerRow = 0
      state.currentStep++
      break
      
    case 'scanning-inner':
      // Check current inner row against outer row
      const outerRowData = outerRows[state.outerRow]
      const innerRowData = innerRows[state.innerRow]
      
      if (joinEvaluator && outerRowData && innerRowData) {
        const isMatch = joinEvaluator(outerRowData, innerRowData)
        
        if (isMatch) {
          state.phase = 'match'
          state.matchedRows.push({
            outer: outerRowData,
            inner: innerRowData
          })
          // Auto-scroll result panel
          nextTick(() => {
            if (resultPanelRef.value) {
              resultPanelRef.value.scrollTop = resultPanelRef.value.scrollHeight
            }
          })
        } else {
          // Move to next inner row
          state.innerRow++
          state.currentStep++
          
          if (state.innerRow >= innerRows.length) {
            // No match found for this outer row
            // For LEFT/FULL JOIN, add outer row with NULL inner
            if (isLeftJoin.value || isFullJoin.value) {
              state.matchedRows.push({
                outer: outerRowData,
                inner: null
              })
            }
            state.outerRow++
            state.phase = 'scanning-outer'
          }
        }
      } else {
        // No evaluator - just move forward
        state.innerRow++
        state.currentStep++
        if (state.innerRow >= innerRows.length) {
          // For LEFT/FULL JOIN without evaluator, also add NULL rows
          if (isLeftJoin.value || isFullJoin.value) {
            const outerRowData = outerRows[state.outerRow]
            state.matchedRows.push({
              outer: outerRowData as Record<string, unknown>,
              inner: null
            })
          }
          state.outerRow++
          state.phase = 'scanning-outer'
        }
      }
      break
      
    case 'match':
      // After match display, move to next inner row
      state.innerRow++
      state.currentStep++
      
      if (state.innerRow >= innerRows.length) {
        state.outerRow++
        state.phase = 'scanning-outer'
      } else {
        state.phase = 'scanning-inner'
      }
      break
      
    case 'finished':
      state.isPlaying = false
      break
  }
}

// Nested Loop controls
function nestedLoopPlay() {
  const state = nestedLoopState.value
  if (state.phase === 'finished') {
    // Reset and replay
    state.outerRow = 0
    state.innerRow = 0
    state.phase = 'idle'
    state.currentStep = 0
    state.matchedRows = []
  }
  state.isPlaying = true
  state.phase = 'scanning-outer'
  
  if (!nestedLoopFrame) {
    nestedLoopFrame = requestAnimationFrame(nestedLoopLoop)
  }
}

function nestedLoopPause() {
  nestedLoopState.value.isPlaying = false
}

function nestedLoopStepForward() {
  const state = nestedLoopState.value
  if (state.phase === 'finished') return
  
  if (!state.isPlaying) {
    advanceNestedLoop()
  }
}

function nestedLoopStepBackward() {
  const state = nestedLoopState.value
  if (state.currentStep <= 0) return

  // O(1) snapshot restore instead of O(n) replay
  const snapshot = stepSnapshots[state.currentStep - 1]
  if (snapshot) {
    state.outerRow = snapshot.outerRow
    state.innerRow = snapshot.innerRow
    state.phase = snapshot.phase
    state.matchedRows = [...snapshot.matchedRows]
    state.currentStep--
    // Remove the snapshot we just restored to (will be re-added if stepping forward again)
    stepSnapshots.length = state.currentStep
  }
}

// ==================== End Nested Loop Animation ====================

// Initialize animation state for each table
function initTableAnimStates() {
  tableAnimStates.value.clear()
  tables.value.forEach((table, index) => {
    const isIndexScan = table.node.nodeType.includes('Index')
    // Index Scan: 2 steps (index search -> heap fetch)
    // Seq Scan: number of rows
    const totalSteps = isIndexScan ? 2 : (table.tableData.rows?.length ?? 0)
    tableAnimStates.value.set(index, {
      isPlaying: false,
      currentStep: 0,
      totalSteps,
      speed: 1
    })
  })
}

// Single table animation loop
let singleAnimationFrame: number | null = null
let singleLastTime = 0

function singleLoop(time: number) {
  if (singleIsPlaying.value) {
    // 使用智能节奏计算步长
    const rowIndex = singleCurrentStep.value
    const isMatch = getCurrentRowIsMatch(rowIndex)
    const hasFilter = !!scanData.value?.node?.filter
    const smartDuration = getSmartStepDuration(rowIndex, isMatch, hasFilter)
    const stepDuration = smartDuration / singleSpeed.value
    
    if (time - singleLastTime > stepDuration) {
      if (singleCurrentStep.value < singleTotalSteps.value) {
        singleCurrentStep.value++
      } else {
        singleIsPlaying.value = false
      }
      singleLastTime = time
    }
  }
  singleAnimationFrame = requestAnimationFrame(singleLoop)
}

// Multi-table animation loops (independent)
const tableAnimationFrames = new Map<number, number>()
const tableLastTimes = new Map<number, number>()

function tableLoop(tableIndex: number) {
  const state = tableAnimStates.value.get(tableIndex)
  if (!state) return
  
  const frameId = requestAnimationFrame((time) => {
    if (state.isPlaying) {
      // 使用智能节奏计算步长（多表模式简化处理）
      const rowIndex = state.currentStep
      const table = tables.value[tableIndex]
      const hasFilter = !!table?.node?.filter
      let isMatch = false
      
      if (hasFilter && table) {
        try {
          const evaluator = getFilterEvaluator(table.node.filter!, table.tableData.columns)
          isMatch = evaluator(table.tableData.rows[rowIndex])
        } catch {
          // ignore
        }
      }
      
      const smartDuration = getSmartStepDuration(rowIndex, isMatch, hasFilter)
      const stepDuration = smartDuration / state.speed
      const lastTime = tableLastTimes.get(tableIndex) ?? time
      
      if (time - lastTime > stepDuration) {
        if (state.currentStep < state.totalSteps) {
          state.currentStep++
        } else {
          state.isPlaying = false
        }
        tableLastTimes.set(tableIndex, time)
      }
    }
    tableAnimationFrames.set(tableIndex, frameId)
    tableLoop(tableIndex)
  })
}

// Watch scanData changes
watch(scanData, (newVal) => {
  // Reset single-table state
  singleIsPlaying.value = false
  singleCurrentStep.value = 0
  
  // Reset nested loop state
  nestedLoopState.value = {
    outerRow: 0,
    innerRow: 0,
    phase: 'idle',
    matchedRows: [],
    isPlaying: false,
    currentStep: 0,
    totalSteps: 0,
    speed: 1,
    matchFlashTimer: null,
    joinType: 'INNER'
  }
  
  if (!newVal) {
    singleTotalSteps.value = 0
    tableAnimStates.value.clear()
    return
  }
  
  // Check for Nested Loop JOIN mode
  if (isNestedLoopJoin.value) {
    initNestedLoopState()
    // Auto-play after a short delay
    setTimeout(() => {
      nestedLoopPlay()
    }, 300)
    return
  }
  
  if (isMultiTable.value) {
    initTableAnimStates()
    // Auto-play all tables after a short delay
    setTimeout(() => {
      tableAnimStates.value.forEach((state, index) => {
        state.isPlaying = true
        tableLoop(index)
      })
    }, 300)
  } else {
    // Single table mode (backward compatible)
    const isIndexScan = newVal.node?.nodeType?.includes('Index') ?? false
    // Index Scan: 2 steps, Seq Scan: row count
    singleTotalSteps.value = isIndexScan ? 2 : (newVal.tableData?.rows?.length ?? 0)
    setTimeout(() => {
      singleIsPlaying.value = true
      if (!singleAnimationFrame) {
        singleAnimationFrame = requestAnimationFrame(singleLoop)
      }
    }, 300)
  }
}, { immediate: true })

// Single table controls
function singlePlay() {
  if (singleCurrentStep.value >= singleTotalSteps.value) {
    singleCurrentStep.value = 0
  }
  singleIsPlaying.value = true
  if (!singleAnimationFrame) {
    singleAnimationFrame = requestAnimationFrame(singleLoop)
  }
}

function singlePause() {
  singleIsPlaying.value = false
}

function singleStepForward() {
  if (singleCurrentStep.value < singleTotalSteps.value) {
    singleCurrentStep.value++
  }
}

function singleStepBackward() {
  if (singleCurrentStep.value > 0) {
    singleCurrentStep.value--
  }
}

function singleSkipToEnd() {
  // 停止动画，直接跳到最终状态
  singleIsPlaying.value = false
  singleCurrentStep.value = singleTotalSteps.value
}

// Multi-table controls (all tables together)
function multiPlay() {
  // Check if nested loop mode
  if (isNestedLoopJoin.value) {
    nestedLoopPlay()
    return
  }
  
  tableAnimStates.value.forEach((state, index) => {
    if (state.currentStep >= state.totalSteps) {
      state.currentStep = 0
    }
    state.isPlaying = true
    if (!tableAnimationFrames.has(index)) {
      tableLoop(index)
    }
  })
}

function multiPause() {
  // Check if nested loop mode
  if (isNestedLoopJoin.value) {
    nestedLoopPause()
    return
  }
  
  tableAnimStates.value.forEach(state => {
    state.isPlaying = false
  })
}

function multiStepForward() {
  // Check if nested loop mode
  if (isNestedLoopJoin.value) {
    nestedLoopStepForward()
    return
  }
  
  tableAnimStates.value.forEach(state => {
    if (state.currentStep < state.totalSteps) {
      state.currentStep++
    }
  })
}

function multiStepBackward() {
  // Check if nested loop mode
  if (isNestedLoopJoin.value) {
    nestedLoopStepBackward()
    return
  }
  
  tableAnimStates.value.forEach(state => {
    if (state.currentStep > 0) {
      state.currentStep--
    }
  })
}

function multiSkipToEnd() {
  // Check if nested loop mode
  if (isNestedLoopJoin.value) {
    // Nested loop: 直接跳到完成状态
    nestedLoopState.value.isPlaying = false
    nestedLoopState.value.phase = 'finished'
    nestedLoopState.value.currentStep = nestedLoopState.value.totalSteps
    return
  }
  
  // 停止所有表的动画，直接跳到最终状态
  tableAnimStates.value.forEach(state => {
    state.isPlaying = false
    state.currentStep = state.totalSteps
  })
}

// Get aggregate state for multi-table controls display
const multiCurrentStep = computed(() => {
  // Nested loop mode
  if (isNestedLoopJoin.value) {
    return nestedLoopState.value.currentStep
  }
  
  let sum = 0
  tableAnimStates.value.forEach(state => sum += state.currentStep)
  return sum
})

const multiTotalSteps = computed(() => {
  // Nested loop mode
  if (isNestedLoopJoin.value) {
    return nestedLoopState.value.totalSteps
  }
  
  let sum = 0
  tableAnimStates.value.forEach(state => sum += state.totalSteps)
  return sum
})

const multiIsPlaying = computed(() => {
  // Nested loop mode
  if (isNestedLoopJoin.value) {
    return nestedLoopState.value.isPlaying
  }
  
  let playing = false
  tableAnimStates.value.forEach(state => {
    if (state.isPlaying) playing = true
  })
  return playing
})

const multiSpeed = computed({
  get: () => {
    // Nested loop mode
    if (isNestedLoopJoin.value) {
      return nestedLoopState.value.speed
    }
    
    const speeds: number[] = []
    tableAnimStates.value.forEach(state => speeds.push(state.speed))
    return speeds[0] ?? 1
  },
  set: (val: number) => {
    if (isNestedLoopJoin.value) {
      nestedLoopState.value.speed = val
      return
    }
    tableAnimStates.value.forEach(state => state.speed = val)
  }
})

// Row status calculation with Index Scan 2-step, Filter, and Nested Loop support
function getRowStatus(tableIndex: number, rowIndex: number) {
  // Nested Loop JOIN mode - coordinated animation
  if (isNestedLoopJoin.value && tables.value.length >= 2) {
    return getNestedLoopRowStatus(tableIndex, rowIndex)
  }
  
  const table = tables.value[tableIndex]
  const state = tableAnimStates.value.get(tableIndex)
  
  if (!state) return 'upcoming'
  
  const isIndexScan = table.node.nodeType.includes('Index')
  
  // 使用预计算的行状态
  const precomputedStatuses = precomputedMultiRowStatuses.value.get(tableIndex) ?? []
  const precomputed = precomputedStatuses[rowIndex]
  
  if (isIndexScan) {
    // Index Scan 2-step animation
    // Step 0: all upcoming
    // Step 1: index searching (rows have special "index-searching" style)
    // Step 2: all rows shown as matched (they passed index lookup)
    if (state.currentStep === 0) {
      return 'upcoming'
    } else if (state.currentStep === 1) {
      return 'index-searching'
    } else {
      // Step 2: all displayed rows are matches from index lookup
      // 使用预计算结果判断是否匹配
      if (precomputed) {
        return precomputed.isMatch ? 'scanned match' : 'scanned'
      }
      return 'scanned match'
    }
  }
  
  // Seq Scan with filter
  const stepIndex = state.currentStep - 1
  
  if (rowIndex === stepIndex) return 'scanning active'
  if (rowIndex < stepIndex) {
    // Already scanned - 使用预计算结果
    if (precomputed) {
      return precomputed.isMatch ? 'scanned match' : 'scanned'
    }
    return 'scanned'
  }
  return 'upcoming'
}

// Nested Loop specific row status
function getNestedLoopRowStatus(tableIndex: number, rowIndex: number): string {
  const state = nestedLoopState.value
  const outerTable = tables.value[0]
  const innerTable = tables.value[1]
  
  if (!outerTable || !innerTable) return 'upcoming'
  
  if (tableIndex === 0) {
    // Outer (driver) table
    if (rowIndex < state.outerRow) return 'scanned'
    if (rowIndex === state.outerRow && (state.phase === 'scanning-inner' || state.phase === 'match' || state.phase === 'scanning-outer')) {
      return 'scanning active'
    }
    if (rowIndex === state.outerRow && state.phase === 'match') {
      return 'scanning match'
    }
    return 'upcoming'
  } else {
    // Inner (driven) table
    if (state.phase === 'scanning-inner' && rowIndex === state.innerRow) {
      return 'scanning active'
    }
    if (state.phase === 'match' && rowIndex === state.innerRow) {
      return 'scanning match'
    }
    // Check if this row was matched before
    const wasMatched = state.matchedRows.some(
      m => m.inner && innerTable.tableData.rows?.[rowIndex] === m.inner
    )
    if (wasMatched) return 'scanned match'
    if (rowIndex < state.innerRow) return 'scanned'
    return 'upcoming'
  }
}

function getSingleRowStatus(index: number) {
  const scanNode = scanData.value?.node
  const isIndexScan = scanNode?.nodeType?.includes('Index') ?? false
  
  // 使用预计算的行状态
  const precomputedStatuses = precomputedSingleRowStatuses.value
  const precomputed = precomputedStatuses[index]
  
  if (isIndexScan) {
    // Index Scan 2-step animation
    if (singleCurrentStep.value === 0) {
      return 'upcoming'
    } else if (singleCurrentStep.value === 1) {
      return 'index-searching'
    } else {
      // Step 2: 使用预计算结果判断是否匹配
      if (precomputed) {
        return precomputed.isMatch ? 'scanned match' : 'scanned'
      }
      return 'scanned match'
    }
  }
  
  // Seq Scan with filter
  const stepIndex = singleCurrentStep.value - 1
  
  if (index === stepIndex) return 'scanning active'
  if (index < stepIndex) {
    // Already scanned - 使用预计算结果
    if (precomputed) {
      return precomputed.isMatch ? 'scanned match' : 'scanned'
    }
    return 'scanned'
  }
  return 'upcoming'
}

// Get current step label for Index Scan
function getIndexScanStepLabel(tableIndex: number): string {
  const state = tableAnimStates.value.get(tableIndex)
  if (!state) return ''
  if (state.currentStep === 0) return ''
  if (state.currentStep === 1) return '索引查找'
  if (state.currentStep === 2) return '回表取数据'
  return ''
}

function getSingleIndexScanStepLabel(): string {
  if (singleCurrentStep.value === 0) return ''
  if (singleCurrentStep.value === 1) return '索引查找'
  if (singleCurrentStep.value === 2) return '回表取数据'
  return ''
}

// Role labels
function getRoleLabel(role: 'outer' | 'inner' | 'single') {
  switch (role) {
    case 'outer': return '驱动表'
    case 'inner': return '被驱动表'
    case 'single': return ''
  }
}

// Calculate cross join row product
const crossJoinProduct = computed(() => {
  if (!isCrossJoin.value || tables.value.length < 2) return null
  const rows1 = tables.value[0]?.tableData?.rows?.length ?? 0
  const rows2 = tables.value[1]?.tableData?.rows?.length ?? 0
  return { rows1, rows2, total: rows1 * rows2 }
})

// Nested Loop phase label
function getNestedLoopPhaseLabel(): string {
  const state = nestedLoopState.value
  switch (state.phase) {
    case 'idle': return '准备开始'
    case 'scanning-outer': return '扫描驱动表'
    case 'scanning-inner': return `扫描被驱动表 (第 ${state.innerRow + 1} 行)`
    case 'match': return '✓ 匹配成功'
    case 'finished': return '完成'
    default: return ''
  }
}

// Get result columns for the middle result set
const resultColumns = computed(() => {
  if (!isNestedLoopJoin.value || tables.value.length < 2) return []
  const outerCols = tables.value[0]?.tableData?.columns ?? []
  const innerCols = tables.value[1]?.tableData?.columns ?? []
  return [...outerCols, ...innerCols]
})

onUnmounted(() => {
  if (singleAnimationFrame) cancelAnimationFrame(singleAnimationFrame)
  tableAnimationFrames.forEach(frameId => cancelAnimationFrame(frameId))
  if (nestedLoopFrame) cancelAnimationFrame(nestedLoopFrame)
})
</script>

<template>
  <div class="scan-path-tab">
    <div v-if="!scanData" class="no-data">
      <p>暂无扫描数据。</p>
      <p style="font-size: 12px; color: var(--text)">请先执行一条查询语句。</p>
    </div>
    
    <!-- Single Table Mode -->
    <div v-else-if="!isMultiTable" class="scan-content">
      <div class="scan-header">
        <div class="badge" :class="{ index: scanData.node?.nodeType?.includes('Index') }">
          {{ scanData.node?.nodeType }}
        </div>
        <div class="scan-info">
          <div>目标表: <strong>{{ scanData.node?.relationName }}</strong></div>
          <div v-if="scanData.node?.filter" class="filter-text" :class="{ 'step-highlight': scanData.node?.nodeType?.includes('Index') && singleCurrentStep === 1 }">
            Filter: {{ scanData.node.filter }}
          </div>
          <div v-if="scanData.node?.indexCond" class="filter-text index-cond" :class="{ 'step-highlight': scanData.node?.nodeType?.includes('Index') && singleCurrentStep === 1 }">
            Index Cond: {{ scanData.node.indexCond }}
          </div>
        </div>
        <!-- Index Scan step indicator -->
        <div v-if="scanData.node?.nodeType?.includes('Index') && singleCurrentStep > 0" class="step-indicator">
          {{ getSingleIndexScanStepLabel() }}
        </div>
      </div>
      
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th v-for="col in (scanData.tableData?.columns ?? [])" :key="col">{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="(row, index) in (scanData.tableData?.rows ?? [])" 
              :key="index"
              :class="getSingleRowStatus(index)"
            >
              <td v-for="col in (scanData.tableData?.columns ?? [])" :key="col">{{ row[col] }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <AnimationControls
        :is-playing="singleIsPlaying"
        :current-step="singleCurrentStep"
        :total-steps="singleTotalSteps"
        :speed="singleSpeed"
        @play="singlePlay"
        @pause="singlePause"
        @step-forward="singleStepForward"
        @step-backward="singleStepBackward"
        @update:speed="val => singleSpeed = val"
        @skip-to-end="singleSkipToEnd"
      />
    </div>
    
    <!-- Multi-Table JOIN Mode -->
    <div v-else class="scan-content multi-table">
      <!-- JOIN Header -->
      <div class="join-header">
        <div class="join-badge" :class="{ 'cross-join': isCrossJoin, 'nested-loop': isNestedLoopJoin }">
          <span v-if="isCrossJoin">⚠️ 笛卡尔积</span>
          <span v-else>🔗 {{ scanData.joinType }}</span>
        </div>
        <div v-if="scanData.joinCondition && !isCrossJoin" class="join-condition">
          ON: {{ scanData.joinCondition }}
        </div>
        <div v-if="isCrossJoin && crossJoinProduct" class="cross-join-warning">
          {{ crossJoinProduct.rows1 }} × {{ crossJoinProduct.rows2 }} = {{ crossJoinProduct.total }} 行
        </div>
        <!-- Nested Loop Phase Indicator -->
        <div v-if="isNestedLoopJoin && nestedLoopState.phase !== 'idle'" class="phase-indicator">
          {{ getNestedLoopPhaseLabel() }}
        </div>
        <!-- Speed Notice -->
        <div v-if="showSpeedNotice" class="speed-notice">
          ⚡ 数据量较大，动画已加速
        </div>
      </div>
      
      <!-- Tables Side by Side -->
      <div class="tables-wrapper" :class="{ 'cross-join': isCrossJoin, 'nested-loop': isNestedLoopJoin }">
        <div 
          v-for="(table, tableIndex) in tables" 
          :key="tableIndex"
          class="table-panel"
          :class="{ 'has-arrow': tableIndex === 0 && !isCrossJoin && !isNestedLoopJoin }"
        >
          <!-- Table Header -->
          <div class="table-panel-header">
            <div class="table-name">
              <strong>{{ table.node.relationName }}</strong>
              <span v-if="table.alias" class="alias">{{ table.alias }}</span>
            </div>
            <div class="table-role" :class="table.role">
              {{ getRoleLabel(table.role) }}
            </div>
            <div class="scan-type-badge" :class="{ index: table.node.nodeType.includes('Index') }">
              {{ table.node.nodeType }}
            </div>
            <!-- Index Scan step indicator -->
            <div v-if="table.node.nodeType.includes('Index')" class="step-indicator mini">
              {{ getIndexScanStepLabel(tableIndex) }}
            </div>
          </div>
          
          <!-- Index Cond display -->
          <div v-if="table.node.indexCond" class="index-cond-header">
            <span class="label">Index Cond:</span>
            <span class="value" :class="{ 'step-highlight': tableAnimStates.get(tableIndex)?.currentStep === 1 }">
              {{ table.node.indexCond }}
            </span>
          </div>
          
          <!-- Filter display -->
          <div v-if="table.node.filter" class="filter-cond-header">
            <span class="label">Filter:</span>
            <span class="value">{{ table.node.filter }}</span>
          </div>
          
          <!-- Table Content -->
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th v-for="col in table.tableData.columns" :key="col">{{ col }}</th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  v-for="(row, rowIndex) in table.tableData.rows" 
                  :key="rowIndex"
                  :class="getRowStatus(tableIndex, rowIndex)"
                >
                  <td v-for="col in table.tableData.columns" :key="col">{{ row[col] }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <!-- Nested Loop Result Panel (中间结果集) -->
      <div v-if="isNestedLoopJoin && nestedLoopState.matchedRows.length > 0" class="result-panel">
        <div class="result-header">
          <span class="result-title">中间结果集</span>
          <span class="result-count">{{ nestedLoopState.matchedRows.length }} 行匹配</span>
        </div>
        <div class="result-table-container" ref="resultPanelRef">
          <table class="result-table">
            <thead>
              <tr>
                <th v-for="col in resultColumns" :key="col" class="result-th">{{ col }}</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="(match, matchIndex) in nestedLoopState.matchedRows" 
                :key="matchIndex"
                class="result-row"
                :class="{ 'new-match': matchIndex === nestedLoopState.matchedRows.length - 1 && nestedLoopState.phase === 'match' }"
              >
                <td v-for="col in (tables[0]?.tableData?.columns ?? [])" :key="'outer-' + col"
                  class="result-td outer-td"
                  :class="{ 'is-null': !match.outer }"
                >
                  {{ match.outer ? match.outer[col] : 'NULL' }}
                </td>
                <td v-for="col in (tables[1]?.tableData?.columns ?? [])" :key="'inner-' + col"
                  class="result-td inner-td"
                  :class="{ 'is-null': !match.inner }"
                >
                  {{ match.inner ? match.inner[col] : 'NULL' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <AnimationControls
        :is-playing="multiIsPlaying"
        :current-step="multiCurrentStep"
        :total-steps="multiTotalSteps"
        :speed="multiSpeed"
        @play="multiPlay"
        @pause="multiPause"
        @step-forward="multiStepForward"
        @step-backward="multiStepBackward"
        @update:speed="val => multiSpeed = val"
        @skip-to-end="multiSkipToEnd"
      />
    </div>
  </div>
</template>

<style scoped>
.scan-path-tab {
  width: 100%;
  color: var(--text);
}

.no-data {
  text-align: center;
  color: #888;
  padding: 40px 0;
}

.scan-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Single Table Styles */
.scan-header {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--code-bg);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  flex-wrap: wrap;
}

.badge {
  background: #3b82f6;
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: bold;
}

.badge.index {
  background: #10b981;
}

.scan-info {
  font-size: 13px;
  line-height: 1.5;
  flex: 1;
}

.filter-text {
  color: #eab308;
  font-family: monospace;
}

.filter-text.index-cond {
  color: #06b6d4;
}

.filter-text.step-highlight {
  background: rgba(234, 179, 8, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
  animation: pulse-highlight 1s ease-in-out infinite;
}

.index-cond.step-highlight {
  background: rgba(6, 182, 212, 0.2);
}

@keyframes pulse-highlight {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* Step Indicator */
.step-indicator {
  background: linear-gradient(135deg, #f59e0b, #ef4444);
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  animation: step-pulse 1.5s ease-in-out infinite;
}

.step-indicator.mini {
  font-size: 11px;
  padding: 2px 8px;
}

@keyframes step-pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
  50% { transform: scale(1.05); box-shadow: 0 0 12px 4px rgba(245, 158, 11, 0.4); }
}

/* Table Container */
.table-container {
  max-height: 250px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--code-bg);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  transition: all 0.2s;
}

th {
  background: rgba(0, 0, 0, 0.3);
  top: 0;
  position: sticky;
  z-index: 10;
  font-weight: 600;
  color: var(--text-h);
}

/* Row Animation States */
tr.upcoming td {
  opacity: 0.4;
}

tr.scanning td,
tr[class="scanning active"] td {
  background-color: rgba(234, 179, 8, 0.15);
  box-shadow: inset 0 2px 0 0 #eab308, inset 0 -2px 0 0 #eab308;
  transform: scale(1.02);
  z-index: 5;
  position: relative;
  font-weight: 500;
}

tr.scanned td {
  opacity: 1;
}

tr[class="scanned match"] td,
tr.match td {
  background-color: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

/* Index Searching State */
tr.index-searching td {
  opacity: 0.5;
  background-color: rgba(6, 182, 212, 0.1);
  animation: index-pulse 0.8s ease-in-out infinite;
}

@keyframes index-pulse {
  0%, 100% { 
    background-color: rgba(6, 182, 212, 0.1);
    box-shadow: inset 0 0 0 0 rgba(6, 182, 212, 0);
  }
  50% { 
    background-color: rgba(6, 182, 212, 0.2);
    box-shadow: inset 0 0 8px 2px rgba(6, 182, 212, 0.3);
  }
}

/* Multi-Table JOIN Styles */
.multi-table {
  gap: 12px;
}

.join-header {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--code-bg);
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid var(--border);
  flex-wrap: wrap;
}

.join-badge {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.join-badge.cross-join {
  background: linear-gradient(135deg, #f59e0b, #ef4444);
}

.join-badge.nested-loop {
  background: linear-gradient(135deg, #10b981, #14b8a6);
  animation: nested-loop-glow 2s ease-in-out infinite;
}

@keyframes nested-loop-glow {
  0%, 100% { box-shadow: 0 0 5px rgba(16, 185, 129, 0.3); }
  50% { box-shadow: 0 0 15px rgba(16, 185, 129, 0.5); }
}

.join-condition {
  font-family: monospace;
  font-size: 13px;
  color: var(--accent-cyan);
  background: rgba(6, 182, 212, 0.1);
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(6, 182, 212, 0.3);
}

.cross-join-warning {
  color: #f59e0b;
  font-size: 13px;
  font-weight: 500;
}

/* Phase Indicator (Nested Loop) */
.phase-indicator {
  background: linear-gradient(135deg, #10b981, #14b8a6);
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  animation: phase-pulse 1s ease-in-out infinite;
}

@keyframes phase-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

/* Speed Notice */
.speed-notice {
  color: #f59e0b;
  font-size: 11px;
  background: rgba(245, 158, 11, 0.1);
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

/* Nested Loop Tables Wrapper */
.tables-wrapper.nested-loop {
  gap: 16px;
}

.tables-wrapper.nested-loop .table-panel:first-child::after {
  content: '⟳';
  position: absolute;
  right: -14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 20px;
  color: #10b981;
  font-weight: bold;
  z-index: 5;
  text-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
  animation: loop-indicator 1.5s ease-in-out infinite;
}

@keyframes loop-indicator {
  0%, 100% { transform: translateY(-50%) rotate(0deg); }
  50% { transform: translateY(-50%) rotate(180deg); }
}

/* Result Panel (中间结果集) */
.result-panel {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: rgba(16, 185, 129, 0.1);
  border-bottom: 1px solid var(--border);
}

.result-title {
  font-weight: 600;
  color: #10b981;
  font-size: 13px;
}

.result-count {
  font-size: 12px;
  color: var(--text);
  background: rgba(16, 185, 129, 0.2);
  padding: 2px 8px;
  border-radius: 10px;
}

.result-table-container {
  max-height: 150px;
  overflow-y: auto;
}

.result-table {
  width: 100%;
  border-collapse: collapse;
}

.result-th {
  padding: 8px 12px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-h);
  background: rgba(0, 0, 0, 0.3);
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid var(--border);
}

.result-td {
  padding: 6px 12px;
  font-size: 12px;
  border-bottom: 1px solid var(--border);
}

.result-td.outer-td {
  color: #60a5fa;
}

.result-td.inner-td {
  color: #c084fc;
}

.result-td.is-null {
  color: var(--accent-danger, #ef4444);
  opacity: 0.7;
  font-style: italic;
}

.result-row.new-match {
  animation: new-match-flash 0.5s ease-out;
}

@keyframes new-match-flash {
  0% {
    background: rgba(16, 185, 129, 0.4);
    transform: scale(1.02);
  }
  100% {
    background: transparent;
    transform: scale(1);
  }
}

/* Tables Side by Side */
.tables-wrapper {
  display: flex;
  gap: 24px;
  position: relative;
}

.table-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.table-panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--code-bg);
  border-radius: 8px;
  border: 1px solid var(--border);
  flex-wrap: wrap;
}

.table-name {
  font-size: 14px;
}

.table-name strong {
  color: var(--text-h);
}

.table-name .alias {
  color: var(--accent-cyan);
  margin-left: 6px;
  font-weight: 500;
}

.table-role {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.table-role.outer {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.4);
}

.table-role.inner {
  background: rgba(168, 85, 247, 0.2);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.4);
}

.scan-type-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 8px;
  background: #3b82f6;
  color: white;
  font-weight: 500;
}

.scan-type-badge.index {
  background: #10b981;
}

/* Index Cond and Filter headers in multi-table mode */
.index-cond-header,
.filter-cond-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  font-size: 12px;
}

.index-cond-header .label,
.filter-cond-header .label {
  color: var(--text);
  opacity: 0.7;
}

.index-cond-header .value {
  font-family: monospace;
  color: var(--accent-cyan);
}

.filter-cond-header .value {
  font-family: monospace;
  color: #eab308;
}

.index-cond-header .value.step-highlight {
  background: rgba(6, 182, 212, 0.2);
  padding: 2px 6px;
  border-radius: 4px;
  animation: pulse-highlight 1s ease-in-out infinite;
}

/* Arrow between tables (CSS pseudo-element) */
.table-panel.has-arrow::after {
  content: '→';
  position: absolute;
  right: -16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 24px;
  color: var(--accent);
  font-weight: bold;
  z-index: 5;
  text-shadow: 0 0 10px var(--accent);
}

/* Nested Loop Phase Indicator */
.phase-indicator {
  background: linear-gradient(135deg, #06b6d4, #3b82f6);
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  animation: phase-pulse 1s ease-in-out infinite;
}

@keyframes phase-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

/* Speed Notice */
.speed-notice {
  color: #f59e0b;
  font-size: 11px;
  background: rgba(245, 158, 11, 0.1);
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

/* Nested Loop Badge Style */
.join-badge.nested-loop {
  background: linear-gradient(135deg, #06b6d4, #8b5cf6);
}

/* Tables Wrapper for Nested Loop */
.tables-wrapper.nested-loop {
  gap: 16px;
}

/* Nested Loop Row Highlight */
tr[class="scanning match"] td {
  background-color: rgba(16, 185, 129, 0.25) !important;
  box-shadow: inset 0 2px 0 0 #10b981, inset 0 -2px 0 0 #10b981;
  color: #10b981;
  font-weight: 600;
  animation: match-row-pulse 0.3s ease-out;
}

@keyframes match-row-pulse {
  0% {
    background-color: rgba(16, 185, 129, 0.5);
    transform: scale(1.03);
  }
  100% {
    background-color: rgba(16, 185, 129, 0.25);
    transform: scale(1);
  }
}

/* Mobile Responsive */
@media (max-width: 600px) {
  .tables-wrapper {
    flex-direction: column;
    gap: 16px;
  }
  
  .table-panel.has-arrow::after {
    content: '↓';
    right: 50%;
    top: auto;
    bottom: -12px;
    transform: translateX(50%);
    font-size: 20px;
  }
  
  .result-panel {
    margin-top: 12px;
  }
  
  .result-th,
  .result-td {
    padding: 5px 8px;
    font-size: 11px;
  }
}
</style>
