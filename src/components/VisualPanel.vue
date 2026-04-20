<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { useVisualStore } from '../stores/visual'

const visual = useVisualStore()

const ExplainTab = defineAsyncComponent(() => import('./visual/ExplainTab.vue'))
const ScanPathTab = defineAsyncComponent(() => import('./visual/ScanPathTab.vue'))
const BTreeTab = defineAsyncComponent(() => import('./visual/BTreeTab.vue'))
const MvccTab = defineAsyncComponent(() => import('./visual/MvccTab.vue'))
</script>

<template>
  <div class="visual-panel">
    <!-- 当有查询计划数据时渲染 -->
    <div v-if="visual.explainData" class="dashboard-card">
      <div class="card-header">EXPLAIN / 查询计划</div>
      <div class="card-body">
        <ExplainTab />
      </div>
    </div>

    <!-- 当有扫描路径数据时渲染 -->
    <div v-if="visual.scanPathData" class="dashboard-card">
      <div class="card-header">SCAN PATH / 扫描路径</div>
      <div class="card-body">
        <ScanPathTab />
      </div>
    </div>

    <!-- 当有B-Tree数据时渲染 -->
    <div v-if="visual.btreeData" class="dashboard-card">
      <div class="card-header">B-TREE / 索引树</div>
      <div class="card-body">
        <BTreeTab />
      </div>
    </div>

    <!-- 当有MVCC数据时渲染 -->
    <div v-if="visual.mvccData" class="dashboard-card">
      <div class="card-header">MVCC / 多版本并发控制</div>
      <div class="card-body">
        <MvccTab />
      </div>
    </div>

    <!-- 如果没有任何数据 (初始状态) -->
    <div 
      v-if="!visual.explainData && !visual.scanPathData && !visual.btreeData && !visual.mvccData" 
      class="placeholder"
    >
      <div class="placeholder-icon">▤</div>
      <div>等待数据流传输...<br/><span style="font-size: 12px; opacity: 0.6;">(执行SQL后将在此自动渲染相关面板)</span></div>
    </div>
  </div>
</template>

<style scoped>
.visual-panel {
  display: grid;
  /* 响应式网格布局，最小宽度400px，自动填满可用列 */
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 16px;
  align-items: start;
  align-content: start;
  width: 100%;
}

.dashboard-card {
  background: rgba(15, 23, 42, 0.4);
  border: 1px solid rgba(6, 182, 212, 0.3);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* 我们通过最大高度限制单卡片不要过长，确保滚动出在内部 */
  max-height: 55vh; 
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.dashboard-card:hover {
  border-color: rgba(6, 182, 212, 0.6);
  box-shadow: 0 6px 20px rgba(6, 182, 212, 0.15);
}

/* 如果只有一个卡片呈现数据，让它占满全部空间 */
.dashboard-card:only-child {
  grid-column: 1 / -1;
  max-height: none;
}

.card-header {
  background: rgba(6, 182, 212, 0.1);
  padding: 8px 12px;
  font-family: var(--mono);
  font-size: 12px;
  font-weight: bold;
  color: var(--accent-cyan);
  border-bottom: 1px solid rgba(6, 182, 212, 0.3);
  text-transform: uppercase;
  letter-spacing: 1px;
  flex-shrink: 0;
}

.card-body {
  padding: 16px;
  overflow-y: auto;
  overflow-x: auto;
  flex: 1;
}

/* 美化内部滚动条 */
.card-body::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.card-body::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.2);
}
.card-body::-webkit-scrollbar-thumb {
  background: rgba(6, 182, 212, 0.3);
  border-radius: 3px;
}
.card-body::-webkit-scrollbar-thumb:hover {
  background: rgba(6, 182, 212, 0.6);
}

.placeholder {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--text);
  font-size: 14px;
  padding-top: 10vh;
  opacity: 0.8;
}

.placeholder-icon {
  font-size: 48px;
  margin-bottom: 12px;
  color: rgba(6, 182, 212, 0.5);
  animation: pulse 2s infinite ease-in-out;
}

@keyframes pulse {
  0% { opacity: 0.5; }
  50% { opacity: 1; text-shadow: 0 0 10px rgba(6, 182, 212, 0.5); }
  100% { opacity: 0.5; }
}
</style>
