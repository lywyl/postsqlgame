<script setup lang="ts">
import { computed, watch, onUnmounted, ref } from 'vue'
import { useVisualStore } from '../../stores/visual'
import { useGameStore } from '../../stores/game'
import { useAnimationController } from '../../composables/useAnimationController'
import AnimationControls from './controls/AnimationControls.vue'

const visual = useVisualStore()
const game = useGameStore()
const {
  isPlaying, currentStep, totalSteps, speed,
  play, pause, stepForward, stepBackward, reset
} = useAnimationController()

const showRealData = ref(false)
const initialized = ref(false)

const mvccData = computed(() => visual.mvccData)

const currentSnapshot = computed(() => {
  if (!mvccData.value) return null
  const idx = currentStep.value
  if (idx < 0 || idx >= mvccData.value.snapshots.length) return null
  return mvccData.value.snapshots[idx]
})

const opIcon: Record<string, string> = {
  INSERT: '➕',
  UPDATE: '✏️',
  DELETE: '🗑️',
  VACUUM: '🧹',
}

watch(mvccData, (newVal, oldVal) => {
  reset()
  showRealData.value = false
  if (newVal) {
    totalSteps.value = newVal.snapshots.length
    // 仅当组件已初始化且从无数据变为有数据时（用户首次执行MVCC相关SQL）解锁成就
    if (initialized.value && !oldVal) {
      game.unlockAchievement('mvcc_viewer')
    }
  } else {
    totalSteps.value = 0
  }
  // 标记组件已初始化
  if (!initialized.value) {
    initialized.value = true
  }
}, { immediate: true })

let animationFrame: number | null = null
let lastTime = 0

function loop(time: number) {
  if (isPlaying.value) {
    const stepDuration = 1200 / speed.value
    if (time - lastTime > stepDuration) {
      if (currentStep.value < totalSteps.value - 1) {
        currentStep.value++
      } else {
        isPlaying.value = false
      }
      lastTime = time
    }
  }
  animationFrame = requestAnimationFrame(loop)
}

watch(isPlaying, (pl) => {
  if (pl) {
    if (currentStep.value >= totalSteps.value - 1) currentStep.value = 0
    lastTime = performance.now()
    if (!animationFrame) animationFrame = requestAnimationFrame(loop)
  }
})


onUnmounted(() => {
  if (animationFrame) cancelAnimationFrame(animationFrame)
})

// 跳到结果功能
function skipToEnd() {
  isPlaying.value = false
  currentStep.value = totalSteps.value - 1
}

function getTupleClass(ctid: string) {
  if (!currentSnapshot.value) return ''
  const tuple = currentSnapshot.value.tuples.find(t => t.ctid === ctid)
  if (!tuple) return ''
  const changed = currentSnapshot.value.changedCtids.includes(ctid)
  const classes: string[] = []
  if (tuple.status === 'live') classes.push('live')
  else if (tuple.status === 'dead') classes.push('dead')
  else if (tuple.status === 'vacuumed') classes.push('vacuumed')
  if (changed) classes.push('changed')
  return classes.join(' ')
}

function isInitialStep(index: number) {
  return index === 0
}
</script>

<template>
  <div class="mvcc-tab">
    <!-- 无 mvccScenario 的关卡：概念引导 -->
    <div v-if="!mvccData" class="no-data">
      <div class="guide-icon">🔬</div>
      <h3>MVCC — 多版本并发控制</h3>
      <p class="guide-desc">PostgreSQL 使用 MVCC 实现高并发：每次写操作不覆盖旧数据，而是创建新版本。</p>
      <div class="guide-cards">
        <div class="guide-card">
          <div class="gc-label">xmin</div>
          <div class="gc-desc">创建此元组的事务 ID</div>
        </div>
        <div class="guide-card">
          <div class="gc-label">xmax</div>
          <div class="gc-desc">使此元组失效的事务 ID（0 = 仍存活）</div>
        </div>
        <div class="guide-card">
          <div class="gc-label">ctid</div>
          <div class="gc-desc">元组的物理位置 (页号, 行号)</div>
        </div>
      </div>
      <p class="guide-hint">部分关卡提供 MVCC 教学剧本，打开后可在此查看动画演示。</p>
    </div>

    <!-- 有 mvccScenario -->
    <div v-else class="mvcc-content">
      <!-- 顶部信息栏 -->
      <div class="mvcc-header">
        <span class="sim-badge">⚠️ 教学模拟</span>
        <span class="table-name">表: {{ mvccData.tableName }}</span>
      </div>

      <!-- 当前步骤解说 -->
      <div v-if="currentSnapshot" class="step-explanation">
        <span class="op-icon">{{ opIcon[currentSnapshot.operation.op] }}</span>
        <span>{{ currentSnapshot.operation.explanation }}</span>
      </div>

      <!-- 事务时间线 -->
      <div class="timeline">
        <div
          v-for="(snap, idx) in mvccData.snapshots"
          :key="idx"
          class="timeline-node"
          :class="{
            active: currentStep === idx,
            past: currentStep > idx,
            initial: isInitialStep(idx),
          }"
          @click="currentStep = idx"
        >
          <span class="tl-icon">{{ isInitialStep(idx) ? '📦' : opIcon[snap.operation.op] }}</span>
          <span class="tl-xid">xid {{ snap.xid }}</span>
        </div>
      </div>

      <!-- 元组堆 -->
      <div class="tuple-heap" v-if="currentSnapshot">
        <table>
          <thead>
            <tr>
              <th class="help-tip" data-tip="物理位置 (页号, 行号)">ctid</th>
              <th class="help-tip" data-tip="创建该行的事务ID">xmin</th>
              <th class="help-tip" data-tip="删除或更新该行的事务ID (0=存活)">xmax</th>
              <th class="help-tip" data-tip="元组当前生命周期状态">status</th>
              <th v-for="col in mvccData.columns" :key="col">{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="tuple in currentSnapshot.tuples"
              :key="tuple.ctid"
              :class="getTupleClass(tuple.ctid)"
            >
              <td class="ctid-cell">{{ tuple.ctid }}</td>
              <td>{{ tuple.xmin }}</td>
              <td>{{ tuple.xmax === 0 ? '—' : tuple.xmax }}</td>
              <td>
                <span class="status-badge" :class="tuple.status">{{ tuple.status }}</span>
              </td>
              <td v-for="col in mvccData.columns" :key="col">{{ tuple.row[col] }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 动画控制条 -->
      <AnimationControls
        :is-playing="isPlaying"
        :current-step="currentStep"
        :total-steps="totalSteps"
        :speed="speed"
        @play="play"
        @pause="pause"
        @step-forward="stepForward"
        @step-backward="stepBackward"
        @update:speed="val => speed = val"
        @skip-to-end="skipToEnd"
      />

      <!-- 真实数据对照区（可折叠） -->
      <div class="real-data-section" v-if="mvccData.realSystemColumns && mvccData.realSystemColumns.length > 0">
        <button class="toggle-real" @click="showRealData = !showRealData">
          {{ showRealData ? '▼ 收起真实数据' : '▶ 查看真实系统列数据' }}
        </button>
        <div v-if="showRealData" class="real-data">
          <p class="real-hint">单会话下 xmax 恒为 0 — 以下为 <code>SELECT *, xmin, xmax, ctid</code> 的真实结果</p>
          <table>
            <thead>
              <tr>
                <th>ctid</th>
                <th>xmin</th>
                <th>xmax</th>
                <th v-for="col in mvccData.columns" :key="col">{{ col }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, idx) in mvccData.realSystemColumns" :key="idx">
                <td>{{ r.ctid }}</td>
                <td>{{ r.xmin }}</td>
                <td>{{ r.xmax === 0 ? '—' : r.xmax }}</td>
                <td v-for="col in mvccData.columns" :key="col">{{ r.row[col] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mvcc-tab {
  width: 100%;
  color: var(--text);
}

.no-data {
  text-align: center;
  padding: 24px 0;
}

.guide-icon {
  font-size: 40px;
  margin-bottom: 8px;
}

.no-data h3 {
  margin: 0 0 8px;
  color: var(--text-h);
}

.guide-desc {
  color: var(--text);
  font-size: 14px;
  max-width: 460px;
  margin: 0 auto 16px;
  line-height: 1.6;
}

.guide-cards {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 16px;
}

.guide-card {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 16px;
  min-width: 120px;
}

.gc-label {
  font-family: monospace;
  font-weight: 700;
  font-size: 15px;
  color: var(--accent);
  margin-bottom: 4px;
}

.gc-desc {
  font-size: 12px;
  color: var(--text);
}

.guide-hint {
  font-size: 12px;
  color: var(--text);
  opacity: 0.7;
}

/* 有数据时 */
.mvcc-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mvcc-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
}

.sim-badge {
  background: #f59e0b;
  color: #000;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.table-name {
  font-weight: 600;
}

.step-explanation {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.6;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.op-icon {
  font-size: 16px;
  flex-shrink: 0;
}

/* 时间线 */
.timeline {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding: 8px 0;
}

.timeline-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  background: var(--code-bg);
  border: 2px solid transparent;
  min-width: 56px;
  transition: all 0.2s;
}

.timeline-node:hover {
  border-color: var(--border);
}

.timeline-node.active {
  border-color: var(--accent);
  background: rgba(99, 102, 241, 0.1);
}

.timeline-node.past {
  opacity: 0.6;
}

.tl-icon {
  font-size: 16px;
}

.tl-xid {
  font-size: 10px;
  color: var(--text);
  font-family: monospace;
}

/* 元组堆 */
.tuple-heap {
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.tuple-heap table {
  width: 100%;
  border-collapse: collapse;
}

.tuple-heap th,
.tuple-heap td {
  padding: 6px 10px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  font-family: monospace;
  transition: all 0.3s;
}

.tuple-heap th {
  background: var(--code-bg);
  position: sticky;
  top: 0;
  z-index: 10;
  font-weight: 600;
}

.ctid-cell {
  color: var(--text);
  opacity: 0.7;
}

/* 元组状态着色 */
tr.live td {
  background: rgba(34, 197, 94, 0.08);
}

tr.dead td {
  background: repeating-linear-gradient(
    45deg,
    rgba(239, 68, 68, 0.03),
    rgba(239, 68, 68, 0.03) 10px,
    rgba(239, 68, 68, 0.08) 10px,
    rgba(239, 68, 68, 0.08) 20px
  );
  opacity: 0.7;
  color: #fca5a5;
}

tr.vacuumed td {
  background: transparent;
  opacity: 0.3;
  text-decoration: line-through;
  color: #64748b;
  border-bottom: 1px dashed var(--border);
  font-style: italic;
}

tr.changed td {
  box-shadow: inset 3px 0 0 0 var(--accent);
  font-weight: 500;
}

.status-badge {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.live {
  background: rgba(34, 197, 94, 0.2);
  color: #16a34a;
}

.status-badge.dead {
  background: rgba(239, 68, 68, 0.2);
  color: #dc2626;
}

.status-badge.vacuumed {
  background: rgba(100, 100, 100, 0.2);
  color: #888;
}

/* 真实数据 */
.real-data-section {
  margin-top: 8px;
}

.toggle-real {
  background: none;
  border: 1px solid var(--border);
  color: var(--text);
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  width: 100%;
  text-align: left;
}

.toggle-real:hover {
  color: var(--accent);
  border-color: var(--accent);
}

.real-data {
  margin-top: 8px;
}

.real-hint {
  font-size: 12px;
  color: var(--text);
  margin: 0 0 8px;
  opacity: 0.8;
}

.real-hint code {
  background: var(--code-bg);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 11px;
}

.real-data table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.real-data th,
.real-data td {
  padding: 6px 10px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  font-family: monospace;
}

.real-data th {
  background: var(--code-bg);
}

/* Tooltips */
.help-tip {
  position: relative;
  cursor: help;
  text-decoration: underline dotted var(--accent);
  text-underline-offset: 4px;
}

.help-tip::after {
  content: attr(data-tip);
  position: absolute;
  bottom: 120%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(11, 15, 25, 0.95);
  border: 1px solid var(--accent);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  color: #fff;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: normal;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s, transform 0.2s;
  z-index: 100;
}

.help-tip:hover::after {
  opacity: 1;
  transform: translateX(-50%) translateY(-2px);
}
</style>
