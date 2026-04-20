<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useVisualStore } from '../../stores/visual'
import { useAnimationController } from '../../composables/useAnimationController'
import AnimationControls from './controls/AnimationControls.vue'
import * as d3 from 'd3'
import type { BTreeNode, BTreeSearchStep } from '../../types'

const visual = useVisualStore()
const {
  isPlaying, currentStep, totalSteps, speed,
  play, pause, stepForward, stepBackward, reset
} = useAnimationController()

const d3Container = ref<HTMLDivElement | null>(null)
const btreeData = computed(() => visual.btreeData)
const isIndexScan = computed(() => {
  const node = visual.scanPathData?.node
  return node?.nodeType.includes('Index') ?? false
})

// 当 btreeData 变化时重新渲染并重置动画（树结构变化）
watch(btreeData, (newVal) => {
  // 清除旧 SVG，强制完整重绘
  svgSelection = null
  nodesSelection = null
  linksSelection = null
  reset()
  if (newVal) {
    totalSteps.value = newVal.searchPath.length
    renderTree(newVal.root, newVal.searchPath, 0)
  }
}, { immediate: true })

// 当动画步骤变化时只更新高亮（增量更新）
watch(currentStep, (step) => {
  if (btreeData.value && svgSelection && nodesSelection) {
    updateHighlight(btreeData.value.searchPath, step)
  }
})

// 动画循环
let animationFrame: number | null = null
let lastTime = 0

function loop(time: number) {
  if (isPlaying.value) {
    const stepDuration = 600 / speed.value
    if (time - lastTime > stepDuration) {
      if (currentStep.value < totalSteps.value) {
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
    if (currentStep.value >= totalSteps.value) currentStep.value = 0
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
  currentStep.value = totalSteps.value
}

// ===== D3 渲染 B+ Tree =====
// 结构性渲染（树变化时调用）与高亮更新（步骤变化时调用）分离
let svgSelection: any = null
let nodesSelection: any = null
let linksSelection: any = null

const nodeWidth = 120
const nodeHeight = 44

function renderTree(root: BTreeNode, searchPath: BTreeSearchStep[], highlightStep: number) {
  if (!d3Container.value) return

  // 如果有现成 SVG，只更新高亮
  if (svgSelection && nodesSelection) {
    updateHighlight(searchPath, highlightStep)
    return
  }

  d3Container.value.innerHTML = ''

  const hierarchy = d3.hierarchy(root, (d) => d.children)
  const levelGap = 80

  const treeLayout = d3.tree<BTreeNode>()
    .nodeSize([nodeWidth + 20, nodeHeight + levelGap])
    .separation(() => 1.2)

  const treeData = treeLayout(hierarchy)

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  treeData.each((d: any) => {
    minX = Math.min(minX, d.x)
    maxX = Math.max(maxX, d.x)
    minY = Math.min(minY, d.y)
    maxY = Math.max(maxY, d.y)
  })

  const padding = 60
  const width = maxX - minX + nodeWidth + padding * 2
  const height = maxY - minY + nodeHeight + padding * 2

  svgSelection = d3.select(d3Container.value)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `${minX - padding} ${minY - padding} ${width} ${height}`)
    .attr('style', 'max-width: 100%; height: auto;')

  const g = svgSelection.append('g')

  // 绘制连接线
  linksSelection = g.append('g')
    .selectAll('path')
    .data(treeData.links())
    .join('path')
    .attr('d', (d: any) => {
      const sx = d.source.x
      const sy = d.source.y + nodeHeight / 2
      const tx = d.target.x
      const ty = d.target.y - nodeHeight / 2
      return `M ${sx},${sy} C ${sx},${(sy + ty) / 2} ${tx},${(sy + ty) / 2} ${tx},${ty}`
    })
    .attr('fill', 'none')
    .attr('stroke', '#555')
    .attr('stroke-width', 1)
    .attr('stroke-opacity', 0.3)

  // 绘制节点
  nodesSelection = g.append('g')
    .selectAll('g')
    .data(treeData.descendants())
    .join('g')
    .attr('transform', (d: any) => `translate(${d.x - nodeWidth / 2},${d.y - nodeHeight / 2})`)

  // 节点外框
  nodesSelection.append('rect')
    .attr('width', nodeWidth)
    .attr('height', nodeHeight)
    .attr('rx', 6)
    .attr('fill', 'var(--code-bg, #1e1e2e)')
    .attr('stroke', '#555')
    .attr('stroke-width', 1)

  // Key 分隔线和文字
  nodesSelection.each(function(this: any, d: any) {
    const nodeG = d3.select(this as SVGGElement)
    const keys: (number | string)[] = d.data.keys
    if (keys.length === 0) return

    const cellWidth = nodeWidth / keys.length

    keys.forEach((key: number | string, i: number) => {
      if (i > 0) {
        nodeG.append('line')
          .attr('x1', cellWidth * i)
          .attr('y1', 4)
          .attr('x2', cellWidth * i)
          .attr('y2', nodeHeight - 4)
          .attr('stroke', '#555')
          .attr('stroke-opacity', 0.5)
      }

      nodeG.append('text')
        .attr('class', `key-${d.data.id}-${i}`)
        .attr('x', cellWidth * i + cellWidth / 2)
        .attr('y', nodeHeight / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--text-h, #ccc)')
        .attr('font-size', '13px')
        .text(String(key))
    })
  })

  // 节点类型标签
  nodesSelection.append('text')
    .attr('x', nodeWidth / 2)
    .attr('y', nodeHeight + 14)
    .attr('text-anchor', 'middle')
    .attr('fill', 'var(--text, #888)')
    .attr('font-size', '10px')
    .text((d: any) => d.data.isLeaf ? '🍃 Leaf' : '📂 Internal')

  // 首次高亮
  updateHighlight(searchPath, highlightStep)
}

function updateHighlight(searchPath: BTreeSearchStep[], highlightStep: number) {
  if (!nodesSelection || !linksSelection) return

  const activeNodeIds = new Set<string>()
  const matchedNodeIds = new Set<string>()
  const currentStepData = highlightStep > 0 ? searchPath[highlightStep - 1] : null
  const currentStepNodeId = currentStepData?.nodeId ?? null

  for (let i = 0; i < highlightStep; i++) {
    activeNodeIds.add(searchPath[i].nodeId)
    if (searchPath[i].found) matchedNodeIds.add(searchPath[i].nodeId)
  }

  // 更新连接线
  linksSelection
    .attr('stroke', (d: any) => {
      if (activeNodeIds.has(d.source.data.id) && activeNodeIds.has(d.target.data.id)) return '#3b82f6'
      return '#555'
    })
    .attr('stroke-width', (d: any) => {
      if (activeNodeIds.has(d.source.data.id) && activeNodeIds.has(d.target.data.id)) return 2.5
      return 1
    })
    .attr('stroke-opacity', (d: any) => {
      if (activeNodeIds.has(d.source.data.id) && activeNodeIds.has(d.target.data.id)) return 1
      return 0.3
    })

  // 更新节点
  nodesSelection.each(function(this: any, d: any) {
    const nodeG = d3.select(this as SVGGElement)
    const nid = d.data.id

    // 更新外框
    nodeG.select('rect')
      .attr('fill', () => {
        if (matchedNodeIds.has(nid)) return '#059669'
        if (nid === currentStepNodeId) return '#2563eb'
        if (activeNodeIds.has(nid)) return 'rgba(37, 99, 235, 0.2)'
        return 'var(--code-bg, #1e1e2e)'
      })
      .attr('stroke', () => {
        if (matchedNodeIds.has(nid)) return '#10b981'
        if (nid === currentStepNodeId) return '#60a5fa'
        if (activeNodeIds.has(nid)) return '#3b82f6'
        return '#555'
      })
      .attr('stroke-width', () => {
        if (nid === currentStepNodeId || matchedNodeIds.has(nid)) return 2.5
        return 1
      })

    // 更新 key 文字颜色
    const keys: (number | string)[] = d.data.keys
    keys.forEach((_, i) => {
      const isHighlightedKey = currentStepData
        && currentStepData.nodeId === nid
        && currentStepData.keyIndex === i

      nodeG.select(`.key-${nid}-${i}`)
        .attr('fill', () => {
          if (isHighlightedKey && currentStepData?.found) return '#34d399'
          if (isHighlightedKey) return '#fbbf24'
          if (matchedNodeIds.has(nid)) return '#fff'
          if (nid === currentStepNodeId) return '#fff'
          return 'var(--text-h, #ccc)'
        })
        .attr('font-weight', isHighlightedKey ? 'bold' : 'normal')
    })
  })
}
</script>

<template>
  <div class="btree-tab">
    <!-- 尚未执行查询 -->
    <div v-if="!visual.scanPathData" class="no-data">
      <p>暂无 B-Tree 数据。请先执行一条查询语句。</p>
    </div>

    <!-- B-Tree 视图 (无论优化器是否选择了 Index Scan，只要我们构建了 BTree 就展示) -->
    <div v-else-if="btreeData" class="btree-content">
      <div class="btree-header">
        <div class="badge">B+ Tree Index</div>
        <div class="btree-info">
          <span>索引列: <strong>{{ btreeData.indexColumn }}</strong></span>
          <span class="divider">|</span>
          <span>搜索值: <strong class="search-key">{{ btreeData.searchKey }}</strong></span>
        </div>
        <!-- 提示：优化器选择了 Seq Scan 但索引存在 -->
        <div v-if="!isIndexScan" class="optimizer-note">
          ⚡ 优化器选择了 Seq Scan（小表时更快），但索引仍然存在
        </div>
      </div>

      <div ref="d3Container" class="d3-container"></div>

      <!-- 当前步骤解说 -->
      <div class="step-narration" v-if="currentStep > 0 && btreeData.searchPath[currentStep - 1]">
        <template v-if="btreeData.searchPath[currentStep - 1].direction === 'enter'">
          🔍 进入节点...
        </template>
        <template v-else-if="btreeData.searchPath[currentStep - 1].direction === 'match'">
          ✅ 找到了！ 目标值 <strong>{{ btreeData.searchKey }}</strong> 在此节点命中！
        </template>
        <template v-else-if="btreeData.searchPath[currentStep - 1].direction === 'left'">
          ⬅️ 目标值小于当前 key, 向左分支移动
        </template>
        <template v-else-if="btreeData.searchPath[currentStep - 1].direction === 'right'">
          ➡️ 目标值大于当前 key, 继续向右比较
        </template>
      </div>

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
    </div>

    <!-- 未创建索引的提示 -->
    <div v-else class="no-index">
      <div class="no-index-icon">🚫</div>
      <div class="no-index-title">未检测到索引</div>
      <p>当前查询的目标表没有匹配的用户索引，走了全表扫描 (Seq Scan)。</p>
      <p class="hint-text">提示: 尝试在 WHERE 条件列上创建 INDEX，然后重新查询来观察 B-Tree 结构！</p>
    </div>
  </div>
</template>

<style scoped>
.btree-tab {
  width: 100%;
  color: var(--text);
}

.no-index {
  text-align: center;
  padding: 32px 16px;
}

.no-index-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.no-index-title {
  font-size: 18px;
  font-weight: bold;
  color: #ef4444;
  margin-bottom: 8px;
}

.no-index p {
  font-size: 13px;
  color: var(--text);
  margin: 4px 0;
}

.hint-text {
  color: #eab308 !important;
  font-style: italic;
  margin-top: 12px !important;
}

.no-data {
  text-align: center;
  color: #888;
  padding: 40px 0;
  font-size: 13px;
}

.btree-content {
  display: flex;
  flex-direction: column;
}

.btree-header {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--code-bg);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  margin-bottom: 12px;
}

.badge {
  background: #8b5cf6;
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: bold;
  white-space: nowrap;
}

.btree-info {
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.divider {
  color: var(--border);
}

.search-key {
  color: #fbbf24;
}

.optimizer-note {
  font-size: 11px;
  color: #fbbf24;
  background: rgba(234, 179, 8, 0.1);
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px solid rgba(234, 179, 8, 0.3);
  white-space: nowrap;
}

.d3-container {
  overflow-x: auto;
  border: 1px solid var(--border);
  background: var(--code-bg);
  border-radius: 8px;
  padding: 16px;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-narration {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 14px;
  text-align: center;
  margin-top: 12px;
  min-height: 24px;
}
</style>
