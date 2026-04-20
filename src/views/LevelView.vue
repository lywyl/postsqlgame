<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { chapters } from '../data/chapters'
import { useDbStore } from '../stores/db'
import { useGameStore } from '../stores/game'
import { useVisualStore } from '../stores/visual'
import { assembleScanPathData } from '../utils/scanPathAssembler'
import { buildBTreeData, buildBTreeFromColumn, parseWhereCondition } from '../utils/btreeSimulator'
import { runMvccScenario } from '../utils/mvccSimulator'
import { translateSqlError } from '../utils/sqlErrorTranslator'
import type { Level, QueryResult, SqlDisplayError, SqlExecutionHistoryItem } from '../types'
import SqlEditor from '../components/SqlEditor.vue'
import ResultTable from '../components/ResultTable.vue'
import TaskPanel from '../components/TaskPanel.vue'
import VisualPanel from '../components/VisualPanel.vue'
import SqlHistoryPanel from '../components/SqlHistoryPanel.vue'

const route = useRoute()
const router = useRouter()
const db = useDbStore()
const game = useGameStore()
const visual = useVisualStore()

const result = ref<QueryResult | null>(null)
const error = ref<SqlDisplayError | null>(null)
const completed = ref(false)
const hintsUsed = ref(0)
const dbReady = ref(false)
const showSuccessPulse = ref(false)

// SQL 执行历史
const executionHistory = ref<SqlExecutionHistoryItem[]>([])
let historyCounter = 0

// 编辑器 ref
const editorRef = ref<InstanceType<typeof SqlEditor> | null>(null)

// 多任务状态
const currentTaskIndex = ref(0)
const taskCompleted = ref<boolean[]>([])
const showSuccessStory = ref(false)

const chapterId = computed(() => route.params.chapterId as string)
const levelId = computed(() => route.params.levelId as string)

const chapter = computed(() => chapters.find((c) => c.id === chapterId.value))
const levelIndex = computed(() =>
  chapter.value?.levels.findIndex((l) => l.id === levelId.value) ?? -1
)
const level = computed<Level | null>(() =>
  levelIndex.value >= 0 ? chapter.value!.levels[levelIndex.value] : null
)
const currentTask = computed(() => level.value?.tasks[currentTaskIndex.value] ?? null)

const nextLevel = computed(() => {
  if (!chapter.value || levelIndex.value < 0) return null
  const next = chapter.value.levels[levelIndex.value + 1]
  if (next) return { chapterId: chapter.value.id, levelId: next.id }
  const chIdx = chapters.findIndex((c) => c.id === chapterId.value)
  const nextCh = chapters[chIdx + 1]
  if (nextCh) return { chapterId: nextCh.id, levelId: nextCh.levels[0].id }
  return null
})

async function initLevel(silent = false) {
  if (!level.value) return

  if (!game.isLevelUnlocked(chapterId.value, levelId.value)) {
    const fallback = game.getFirstUnlockedLevel(chapterId.value)
    if (fallback) {
      router.replace(`/level/${chapterId.value}/${fallback}`)
    } else {
      router.replace('/')
    }
    return
  }

  dbReady.value = false
  result.value = null
  error.value = null
  visual.setExplainData(null)
  visual.setMvccData(null)
  visual.setScanPathData(null)
  visual.setBtreeData(null)

  // SQL 执行历史（关卡切换时清空）
  executionHistory.value = []
  historyCounter = 0

  try {
    await db.init()
    await db.execMultiple('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
    await db.execMultiple(level.value.initSql)
    dbReady.value = true

    if (level.value.mvccScenario) {
      const snapshots = runMvccScenario(level.value.mvccScenario)
      visual.setMvccData({
        tableName: level.value.mvccScenario.tableName,
        columns: level.value.mvccScenario.columns,
        snapshots,
        realSystemColumns: null,
      })
      game.unlockAchievement('mvcc_viewer')
    }

    // 从 gameStore 恢复已完成的任务进度
    if (game.isLevelCompleted(chapterId.value, levelId.value)) {
      completed.value = true
      taskCompleted.value = new Array(level.value.tasks.length).fill(true)
      currentTaskIndex.value = level.value.tasks.length - 1
      showSuccessStory.value = false
      const stars = game.getLevelStars(chapterId.value, levelId.value)
      hintsUsed.value = Math.max(0, Math.ceil((3 - stars) * 1.5)) // 估算 hintsUsed
    } else {
      // 未完成的关卡：从头开始
      completed.value = false
      hintsUsed.value = 0
      currentTaskIndex.value = 0
      showSuccessStory.value = false
      taskCompleted.value = new Array(level.value.tasks.length).fill(false)
    }

    // 重置编辑器（清除 undo 栈）—— 仅在非静默模式
    if (!silent) {
      editorRef.value?.setCode('')
    }
  } catch (e: unknown) {
    if (!silent) {
      error.value = translateSqlError('数据库初始化失败: ' + (e instanceof Error ? e.message : String(e)))
    }
    console.error('Database initialization failed:', e)
  }
}

async function handleExecute(sql: string) {
  if (!dbReady.value || !level.value || !currentTask.value) return
  error.value = null
  result.value = null
  visual.setExplainData(null)

  try {
    const explainData = await db.explain(sql).catch((err) => {
      console.warn('Explain fail:', err)
      return null
    })

    visual.setExplainData(explainData)
    visual.setScanPathData(null)
    visual.setBtreeData(null)

    let passed = false
    const hasCheck = !!currentTask.value!.checkSql

    if (hasCheck) {
      // DML 事务流开始
      let playerState: QueryResult | null = null
      let playerError: unknown = null

      if (currentTask.value!.needsTransaction) {
        // === 事务感知模式 ===
        // 用于含事务控制(BEGIN/COMMIT/ROLLBACK)、多语句、CHECKPOINT 的任务
        // 1. 直接执行玩家多语句（不包裹事务）
        // 2. 用 checkSql 获取修改后状态
        // 3. 重新初始化数据库恢复干净状态
        // 4. 执行标准答案
        // 5. 用 checkSql 获取标准答案状态，对比
        // 6. 通过则数据库已在答案状态；失败则重新初始化
        try {
          await db.execMultiple(sql)
          playerState = await db.queryRaw(currentTask.value!.checkSql!)
          result.value = playerState
          
          historyCounter++
          executionHistory.value.unshift({
            id: `hist-${historyCounter}`,
            sql,
            timestamp: Date.now(),
            success: true,
          })
        } catch (e: unknown) {
          playerError = e
        }

        if (!playerError && playerState) {
          // 重初始化数据库，恢复干净状态
          await initLevel(true)

          try {
            await db.execMultiple(currentTask.value!.answerSql)
            const answerState = await db.queryRaw(currentTask.value!.checkSql!)
            passed = checkAnswer(playerState, answerState)

            if (!passed) {
              // 答案不匹配，再重初始化一次
              await initLevel(true)
            }
            // 如果通过，数据库已在答案状态，直接用于下一关
          } catch (e) {
            await initLevel(true)
            console.error('Answer check execution failed:', e)
          }
        }

        if (playerError) {
          throw playerError
        }
      } else {
        // === 常规 DML 模式（现有逻辑）===
        // 执行玩家SQL，使用 BEGIN; ... ROLLBACK; 隔离
        await db.exec('BEGIN;')
        try {
          await db.exec(sql)
          // 获取修改后状态
          playerState = await db.exec(currentTask.value!.checkSql!)
          // 专门为DML展示改变后的数据，而不是没用的 "UPDATE 1"
          result.value = playerState
          
          historyCounter++
          executionHistory.value.unshift({
            id: `hist-${historyCounter}`,
            sql,
            timestamp: Date.now(),
            success: true,
          })
        } catch (e: unknown) {
          playerError = e
        }
        await db.exec('ROLLBACK;')

        // 如果玩家语法等一切正确，则执行答案去对比
        if (!playerError && playerState) {
          await db.exec('BEGIN;')
          try {
            await db.exec(currentTask.value!.answerSql)
            const answerState = await db.exec(currentTask.value!.checkSql!)
            passed = checkAnswer(playerState, answerState)

            if (passed) {
              // 如果比对成功，保留标准答案产生的 DB 状态变化，玩家继续下一关
              await db.exec('COMMIT;')
            } else {
              // 如果只是效果没达成，撤回标准答案的影响
              await db.exec('ROLLBACK;')
            }
          } catch (e) {
            await db.exec('ROLLBACK;')
            console.error('Answer check execution failed:', e)
          }
        }

        if (playerError) {
          // 如果玩家刚才在 BEGIN 块抛出异常（例如语法不对），抛出去让 catch 处理报错面板显示
          throw playerError
        }
      }
    } else {
      // 常规 SELECT 模式
      const queryResult = await db.exec(sql)
      result.value = queryResult
      
      historyCounter++
      executionHistory.value.unshift({
        id: `hist-${historyCounter}`,
        sql,
        timestamp: Date.now(),
        success: true,
      })
      
      const answerResult = await db.exec(currentTask.value!.answerSql)
      passed = checkAnswer(queryResult, answerResult)
    }

    if (/CREATE\s+INDEX/i.test(sql)) {
      game.unlockAchievement('tree_planter')
    }

    if (explainData?.plan) {
      // 使用 scanPathAssembler 组装多表扫描数据
      const scanPathData = await assembleScanPathData(explainData.plan, (tableName) => db.getTableData(tableName))
      if (scanPathData) {
        visual.setScanPathData(scanPathData)

        // B-Tree 联动：优先使用第一个 Index Scan 节点
        const firstScan = scanPathData.tables[0]
        if (firstScan.node.nodeType.includes('Index') && firstScan.node.indexCond) {
          const btree = buildBTreeData(firstScan.tableData.rows as Record<string, unknown>[], firstScan.node.indexCond)
          visual.setBtreeData(btree)
          game.unlockAchievement('index_scan')
        } else {
          // 备选：主动查 pg_indexes 匹配 WHERE 列名
          try {
            const tableName = firstScan.node.relationName
            if (tableName) {
              const indexes = await db.getTableIndexes(tableName)
              if (indexes.length > 0) {
                const whereParsed = parseWhereCondition(sql)
                if (whereParsed) {
                  const matchedIndex = indexes.find(idx => idx.columnName === whereParsed.column)
                  if (matchedIndex) {
                    const btree = buildBTreeFromColumn(
                      firstScan.tableData.rows as Record<string, unknown>[],
                      matchedIndex.columnName,
                      whereParsed.value
                    )
                    visual.setBtreeData(btree)
                  }
                }
              }
            }
          } catch (err) {
            console.warn('索引检测失败:', err)
          }
        }
      }
    }

    if (visual.mvccData && level.value.mvccScenario) {
      db.getTableDataWithSystemColumns(level.value.mvccScenario.tableName)
        .then(realData => {
          visual.setMvccData({
            ...visual.mvccData!,
            realSystemColumns: realData,
          })
        })
        .catch(err => console.warn('获取 MVCC 真实系统列失败:', err))
    }

    // 验证当前任务是否通过
    if (passed) {
      // Trigger Green Pulse effect
      showSuccessPulse.value = true
      setTimeout(() => { showSuccessPulse.value = false }, 1000)

      // 标记当前任务完成
      taskCompleted.value[currentTaskIndex.value] = true

      // 如果当前任务有后置剧情，则挂起进度等待用户点击
      if (currentTask.value!.successStory) {
        showSuccessStory.value = true
      } else {
        advanceTask()
      }
    } else if (hasCheck) {
      // 对于 DML，如果没有抛出异常但 passed = false，我们需要抛出差异错误提示玩家
      throw new Error('DML 验证失败：你修改后的数据不符合预期，操作已被安全回滚。')
    }
  } catch (e: unknown) {
    const rawMsg = e instanceof Error ? e.message : String(e)
    // 使用教学化错误翻译
    error.value = translateSqlError(rawMsg)

    // 记录失败历史
    historyCounter++
    executionHistory.value.unshift({
      id: `hist-${historyCounter}`,
      sql,
      timestamp: Date.now(),
      success: false,
      errorSummary: error.value.friendlyMessage.slice(0, 80),
    })
  }
}

function rowsEqual(cols: string[], a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  return cols.every((col) => {
    const va = a[col]
    const vb = b[col]
    // NULL 处理
    if (va === null && vb === null) return true
    if (va === null || vb === null) return false
    // 类型相同时用严格比较
    if (typeof va === typeof vb) return va === vb
    // 类型不同时退化为字符串比较
    return String(va) === String(vb)
  })
}

function sortRows(cols: string[], rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...rows].sort((a, b) => {
    for (const col of cols) {
      const va = String(a[col])
      const vb = String(b[col])
      if (va < vb) return -1
      if (va > vb) return 1
    }
    return 0
  })
}

function advanceTask() {
  showSuccessStory.value = false
  if (currentTaskIndex.value < level.value!.tasks.length - 1) {
    currentTaskIndex.value++
    result.value = null
  } else {
    // 所有任务完成
    completed.value = true
    const stars = hintsUsed.value === 0 ? 3 : hintsUsed.value <= 2 ? 2 : 1
    game.completeLevel(chapterId.value, levelId.value, stars, hintsUsed.value)
  }
}

function checkAnswer(player: QueryResult, answer: QueryResult): boolean {
  if (player.rowCount !== answer.rowCount) return false
  if (player.columns.length !== answer.columns.length) return false

  const cols = answer.columns

  const needsOrder = currentTask.value && /ORDER\s+BY/i.test(currentTask.value.answerSql)

  if (needsOrder) {
    for (let i = 0; i < player.rows.length; i++) {
      if (!rowsEqual(cols, player.rows[i], answer.rows[i])) return false
    }
    return true
  }

  const ps = sortRows(cols, player.rows as Record<string, unknown>[])
  const as = sortRows(cols, answer.rows as Record<string, unknown>[])
  for (let i = 0; i < ps.length; i++) {
    if (!rowsEqual(cols, ps[i], as[i])) return false
  }
  return true
}

function handleHint(_index: number) {
  hintsUsed.value++
}

function restoreFromHistory(sql: string) {
  editorRef.value?.setCode(sql)
}

function goNext() {
  if (nextLevel.value) {
    router.push(`/level/${nextLevel.value.chapterId}/${nextLevel.value.levelId}`)
  } else {
    router.push('/')
  }
}

onMounted(() => initLevel())
watch([chapterId, levelId], () => initLevel())
</script>
<template>
  <div class="level-view" v-if="level && chapter">
    <header class="level-header">
      <router-link to="/" class="back-btn">← 返回</router-link>
      <span class="chapter-name">{{ chapter.title }}</span>
      <span class="level-name">{{ level.title }}</span>
    </header>

    <div class="level-layout">
      <!-- 加载状态覆盖层 -->
      <div v-if="!dbReady" class="loading-overlay">
        <div class="loading-spinner">
          <div class="spinner-ring"></div>
          <div class="loading-text">INITIALIZING DATABASE...</div>
        </div>
      </div>

      <!-- 左侧：任务面板及完成状态 -->
      <div class="left-panel glass-panel">
        <div class="task-container">
          <TaskPanel
            :level="level"
            :current-task-index="currentTaskIndex"
            :hints-used="hintsUsed"
            :task-completed="taskCompleted"
            :show-success-story="showSuccessStory"
            @hint="handleHint"
            @continue="advanceTask"
          />
        </div>

        <!-- 完成弹窗 -->
        <div v-if="completed" class="completion-banner">
          <div class="completion-title">SYSTEM_OVERRIDE_COMPLETE // NODE_CLEARED</div>
          <div class="completion-text">
            <span class="typewriter-cursor">></span> {{ hintsUsed === 0 ? '完美潜入：未触发任何系统警报。评级：S级' : '突破完成：核心网络响应，残留操作痕迹。评级：A级' }}
          </div>
          <button class="btn-next neon-btn" style="width: 100%" @click="goNext">
            {{ nextLevel ? '> 开启下一层网段通道' : '> 暂切回主理区' }}
          </button>
        </div>
      </div>

      <!-- 右侧：全息视口基地 -->
      <div class="right-hologram-viewport" :class="{ 'success-pulse': showSuccessPulse }">
        <!-- 绝对底层：全息可视化面板 -->
        <VisualPanel class="visual-bg" :class="{ expanded: visual.isExpanded }" />

        <!-- 悬浮交互层：SQL 骇客终端与数据流抽取 -->
        <div class="hud-consoles">
          <div class="editor-section glass-panel glow-border">
            <SqlEditor ref="editorRef" @execute="handleExecute" />
            <SqlHistoryPanel :items="executionHistory" @restore="restoreFromHistory" />
          </div>

          <div class="result-section glass-panel glow-border">
            <ResultTable :result="result" :error="error" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="not-found">
    <p>关卡不存在</p>
    <router-link to="/">返回首页</router-link>
  </div>
</template>

<style scoped>
.level-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.level-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--code-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  position: relative;
  z-index: 100;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

.back-btn {
  color: var(--accent);
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.back-btn:hover {
  color: var(--accent-cyan);
  text-shadow: 0 0 8px var(--accent-cyan);
}

.chapter-name {
  font-size: 14px;
  color: var(--text);
  opacity: 0.7;
}

.level-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-h);
  text-shadow: 0 0 4px rgba(255, 255, 255, 0.3);
}

.level-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
  background: rgba(11, 15, 25, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.spinner-ring {
  width: 48px;
  height: 48px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--accent);
  letter-spacing: 2px;
  text-transform: uppercase;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  50% { opacity: 0.5; }
}

.left-panel {
  width: 280px;
  margin: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 20;
}

.task-container {
  flex: 1;
  overflow-y: auto;
}

.right-hologram-viewport {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.3s ease;
}

.right-hologram-viewport.success-pulse {
  animation: hackSuccess 2.5s ease-out forwards;
}

/* 扫描线叠加层 */
.right-hologram-viewport.success-pulse::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 50;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(16, 185, 129, 0.03) 2px,
    rgba(16, 185, 129, 0.03) 4px
  );
  animation: scanlines 2.5s ease-out forwards;
}

/* 边框辉光层 */
.right-hologram-viewport.success-pulse::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 51;
  pointer-events: none;
  border: 2px solid transparent;
  animation: borderHack 2.5s ease-out forwards;
}

@keyframes hackSuccess {
  0% {
    box-shadow:
      inset 0 0 80px rgba(16, 185, 129, 0.4),
      inset 0 0 120px rgba(6, 182, 212, 0.2),
      0 0 60px rgba(16, 185, 129, 0.5),
      0 0 100px rgba(6, 182, 212, 0.3);
    filter: brightness(1.3) saturate(1.2);
    transform: translate(0);
  }
  5% {
    transform: translate(-2px, 1px);
    filter: brightness(1.4) saturate(1.3) hue-rotate(10deg);
  }
  10% {
    transform: translate(1px, -1px);
    filter: brightness(1.2) saturate(1.4) hue-rotate(-5deg);
  }
  15% {
    transform: translate(-1px, 0);
    filter: brightness(1.3) saturate(1.2);
  }
  20% {
    box-shadow:
      inset 0 0 60px rgba(139, 92, 246, 0.3),
      inset 0 0 100px rgba(16, 185, 129, 0.2),
      0 0 80px rgba(139, 92, 246, 0.4),
      0 0 120px rgba(16, 185, 129, 0.3);
    filter: brightness(1.1) saturate(1.1);
    transform: translate(0);
  }
  40% {
    box-shadow:
      inset 0 0 40px rgba(16, 185, 129, 0.2),
      inset 0 0 80px rgba(6, 182, 212, 0.15),
      0 0 40px rgba(16, 185, 129, 0.3),
      0 0 80px rgba(6, 182, 212, 0.2);
    filter: brightness(1.05);
  }
  100% {
    box-shadow: none;
    filter: none;
    transform: translate(0);
  }
}

@keyframes scanlines {
  0% { opacity: 1; }
  40% { opacity: 0.6; }
  100% { opacity: 0; }
}

@keyframes borderHack {
  0% {
    border-color: rgba(16, 185, 129, 0.8);
    box-shadow: 0 0 15px rgba(16, 185, 129, 0.6), inset 0 0 15px rgba(16, 185, 129, 0.3);
  }
  25% {
    border-color: rgba(6, 182, 212, 0.6);
    box-shadow: 0 0 20px rgba(6, 182, 212, 0.5), inset 0 0 20px rgba(6, 182, 212, 0.2);
  }
  50% {
    border-color: rgba(139, 92, 246, 0.5);
    box-shadow: 0 0 15px rgba(139, 92, 246, 0.4), inset 0 0 10px rgba(139, 92, 246, 0.2);
  }
  100% {
    border-color: transparent;
    box-shadow: none;
  }
}

.visual-bg {
  position: absolute;
  inset: 0;
  z-index: 10;
  padding: 16px;
  padding-bottom: 32vh;
  overflow: auto;
}

.hud-consoles {
  position: absolute;
  bottom: 16px;
  left: 16px;
  right: 16px;
  z-index: 20;
  display: flex;
  gap: 16px;
  height: 28vh;
  pointer-events: none;
}

.editor-section {
  flex: 1;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.result-section {
  flex: 1;
  pointer-events: auto;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.glow-border {
  border-color: var(--accent-soft);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), inset 0 0 10px rgba(16, 185, 129, 0.05);
}

.completion-banner {
  flex-shrink: 0;
  background: rgba(16, 185, 129, 0.05);
  border: 1px solid var(--accent);
  box-shadow: 0 0 15px rgba(16, 185, 129, 0.15);
  border-radius: 4px;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.completion-title {
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--accent);
  font-weight: 600;
  margin-bottom: 12px;
  text-shadow: 0 0 5px var(--accent);
}

.completion-text {
  font-size: 14px;
  color: #fff;
  margin-bottom: 20px;
  border-left: 2px solid var(--accent);
  padding-left: 12px;
  font-family: var(--mono);
}

.neon-btn {
  background: var(--accent-soft);
  color: var(--accent);
  border: 1px solid var(--accent);
  padding: 8px 24px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: all 0.2s;
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.2);
}

.neon-btn:hover {
  background: var(--accent);
  color: #000;
  box-shadow: 0 0 20px var(--accent);
}

.not-found {
  text-align: center;
  padding: 80px 20px;
  color: var(--accent-danger);
  font-family: var(--mono);
}
</style>
