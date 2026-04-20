<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useVisualStore } from '../../stores/visual'
import * as d3 from 'd3'
import type { ExplainNode } from '../../types'

const visual = useVisualStore()
const d3Container = ref<HTMLDivElement | null>(null)
const selectedNode = ref<ExplainNode | null>(null)

function renderTree(rootData: ExplainNode) {
  if (!d3Container.value) return

  // 每次数据变化都完整重建（explain 数据变化频率低）
  try {
    d3Container.value.innerHTML = ''
  } catch {
    return
  }

  const marginLeft = 50
  const marginRight = 150

  const root = d3.hierarchy<ExplainNode>(rootData, (d) => d.children)
  const dx = 80
  const dy = 200
  const tree = d3.tree<ExplainNode>().nodeSize([dx, dy])
  
  tree(root)

  let x0 = Infinity
  let x1 = -x0
  let y1 = 0
  root.each((d: any) => {
    if (d.x > x1) x1 = d.x
    if (d.x < x0) x0 = d.x
    if (d.y > y1) y1 = d.y
  })
  
  const height = x1 - x0 + dx * 2
  const width = y1 + marginLeft + marginRight

  const svg = d3.select(d3Container.value).append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [-marginLeft, x0 - dx, width, height])
      .attr("style", "max-width: none; font: 13px sans-serif; display: block; margin: 0 auto;");

  const g = svg.append("g")
      .attr("transform", `translate(${marginLeft},0)`)

  // Links
  g.append("g")
    .attr("fill", "none")
    .attr("stroke", "#555")
    .attr("stroke-opacity", 0.4)
    .attr("stroke-width", 1.5)
    .selectAll("path")
    .data(root.links())
    .join("path")
    .attr("d", d3.linkHorizontal<any, any>()
        .x((d: any) => d.y)
        .y((d: any) => d.x))

  // Nodes — 可点击
  const node = g.append("g")
    .selectAll("g")
    .data(root.descendants())
    .join("g")
    .attr("transform", (d: any) => `translate(${d.y},${d.x})`)
    .style("cursor", "pointer")
    .on("click", (_event: MouseEvent, d: any) => {
      selectedNode.value = d.data
    })

  node.append("circle")
      .attr("fill", (d: any) => {
        const actual = d.data.actualRows ?? 0
        const planned = d.data.planRows ?? 0
        const diff = Math.abs(actual - planned)
        if (actual > 0 && diff / actual > 10) return "#ef4444"
        if (actual > 0 && diff / actual > 2) return "#eab308"
        return "#22c55e"
      })
      .attr("r", 10)
      .attr("stroke", (d: any) => {
        return selectedNode.value?.nodeType === d.data.nodeType && selectedNode.value?.totalCost === d.data.totalCost
          ? "#60a5fa" : "transparent"
      })
      .attr("stroke-width", 3)

  // Node Type text
  node.append("text")
      .attr("dy", "-1.5em")
      .attr("x", 0)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--text-h)")
      .text((d: any) => d.data.nodeType)
      
  // Sub text info
  node.append("text")
      .attr("dy", "1.5em")
      .attr("x", 0)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--text)")
      .attr("font-size", "10px")
      .text((d: any) => `cost: ${d.data.totalCost}`)
      
  node.append("text")
      .attr("dy", "2.8em")
      .attr("x", 0)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--text)")
      .attr("font-size", "10px")
      .text((d: any) => {
        if (d.data.relationName) {
           return `on ${d.data.relationName}`
        }
        return ''
      })
}

onMounted(() => {
  if (visual.explainData?.plan) {
    renderTree(visual.explainData.plan)
  } else if (d3Container.value) {
    d3Container.value.innerHTML = '<div class="no-data">暂无查询计划分析数据。请执行查询。</div>'
  }
})

watch(() => visual.explainData, (newData) => {
  selectedNode.value = null
  if (newData?.plan) {
    renderTree(newData.plan)
  } else if (d3Container.value) {
    d3Container.value.innerHTML = '<div class="no-data">暂无查询计划分析数据。</div>'
  }
})
</script>

<template>
  <div class="explain-tab">
    <div v-if="visual.explainData" class="meta">
      执行耗时: {{ visual.explainData.executionTime ?? 0 }}ms | 规划耗时: {{ visual.explainData.planningTime ?? 0 }}ms
    </div>
    <div ref="d3Container" class="d3-container"></div>
    <div v-if="selectedNode" class="node-detail glass-panel">
      <div class="detail-title">{{ selectedNode.nodeType }}</div>
      <div class="detail-row" v-if="selectedNode.relationName">
        <span class="detail-label">表名:</span>
        <span class="detail-value">{{ selectedNode.relationName }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">启动代价:</span>
        <span class="detail-value">{{ selectedNode.startupCost }}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">总代价:</span>
        <span class="detail-value">{{ selectedNode.totalCost }}</span>
      </div>
      <div class="detail-row" v-if="selectedNode.planRows != null">
        <span class="detail-label">预估行数:</span>
        <span class="detail-value">{{ selectedNode.planRows }}</span>
      </div>
      <div class="detail-row" v-if="selectedNode.actualRows != null">
        <span class="detail-label">实际行数:</span>
        <span class="detail-value">{{ selectedNode.actualRows }}</span>
      </div>
      <div class="detail-row" v-if="selectedNode.actualLoops != null">
        <span class="detail-label">执行次数:</span>
        <span class="detail-value">{{ selectedNode.actualLoops }}</span>
      </div>
      <div class="detail-row" v-if="selectedNode.indexCond">
        <span class="detail-label">索引条件:</span>
        <span class="detail-value detail-code">{{ selectedNode.indexCond }}</span>
      </div>
      <div class="detail-row" v-if="selectedNode.filter">
        <span class="detail-label">过滤条件:</span>
        <span class="detail-value detail-code">{{ selectedNode.filter }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.explain-tab {
  width: 100%;
}
.meta {
  font-size: 13px;
  color: var(--text-h);
  background: var(--code-bg);
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 12px;
  text-align: center;
}
.d3-container {
  overflow: auto;
  border: 1px solid var(--border);
  background: var(--code-bg);
  border-radius: 8px;
  padding: 16px;
  min-height: 150px;
  max-height: 600px;
}

.node-detail {
  margin-top: 12px;
  padding: 12px;
  font-size: 12px;
  font-family: var(--mono);
}

.detail-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--accent-cyan);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px solid var(--border);
}

.detail-label {
  color: var(--text);
}

.detail-value {
  color: var(--text-h);
  font-weight: 600;
}

.detail-code {
  font-family: var(--mono);
  font-size: 11px;
  word-break: break-all;
  max-width: 70%;
  text-align: right;
}
</style>
<style>
/* Un-scoped styles for dynamically injected nodes */
.no-data {
  text-align: center;
  color: #888;
  padding: 24px;
}
</style>
