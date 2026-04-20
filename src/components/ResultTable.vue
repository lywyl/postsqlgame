<script setup lang="ts">
import type { QueryResult, SqlDisplayError } from '../types'

defineProps<{
  result: QueryResult | null
  error: SqlDisplayError | null
}>()

// 数据流闪烁效果（已移除常驻动画，节省性能）
// const streamChars = ref('')
// const streamInterval = ref<number | null>(null)
// const chars = '01アイウエオカキクケコ█▓▒░'
</script>

<template>
  <div class="result-panel">
    <div v-if="error" class="result-error">
      <div class="error-friendly">
        <span class="error-icon">⚠</span>
        {{ error.friendlyMessage }}
      </div>
      <div class="error-raw">
        <div class="error-raw-label">RAW ERROR //</div>
        <div class="error-raw-content">{{ error.rawMessage }}</div>
      </div>
    </div>

    <div v-else-if="result">
      <div class="result-meta">
        <span class="meta-label">DATA_STREAM //</span> {{ result.rowCount }} ITEMS_FOUND · {{ result.duration }}ms
      </div>

      <table v-if="result.rowCount > 0" class="result-table">
        <thead>
          <tr>
            <th v-for="col in result.columns" :key="col">{{ col }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in result.rows" :key="i">
            <td v-for="col in result.columns" :key="col">
              {{ row[col] ?? 'NULL' }}
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="result-empty">查询成功，无结果行</div>
    </div>

    <div v-else class="result-placeholder">
      <span class="typewriter-cursor">></span> AWAITING_DATA_STREAM... // 输入 SQL 并运行
    </div>
  </div>
</template>

<style scoped>
.result-panel {
  border-radius: 8px;
  overflow: auto;
  flex: 1;
  min-height: 150px;
  background: transparent;
  font-family: var(--mono);
}

.result-meta {
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-cyan);
  background: rgba(6, 182, 212, 0.1);
  border-bottom: 1px solid var(--border);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.meta-label {
  opacity: 0.7;
  margin-right: 8px;
  color: var(--accent);
}

.result-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.result-table th {
  background: rgba(15, 23, 42, 0.8);
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
  border-bottom: 1px solid var(--accent-soft);
  color: var(--accent);
  position: sticky;
  top: 0;
  z-index: 1;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.result-table td {
  padding: 6px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  color: var(--text-h);
}

.result-table tr:hover td {
  background: rgba(16, 185, 129, 0.1);
  color: var(--accent);
  text-shadow: 0 0 5px var(--accent-soft);
}

.result-error {
  padding: 12px 16px;
  font-family: var(--mono);
}

.error-friendly {
  color: #ef4444;
  font-size: 14px;
  line-height: 1.6;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.error-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.error-raw {
  margin-top: 10px;
  border-top: 1px solid rgba(239, 68, 68, 0.2);
  padding-top: 8px;
}

.error-raw-label {
  font-size: 10px;
  font-weight: 600;
  color: rgba(239, 68, 68, 0.4);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.error-raw-content {
  color: rgba(239, 68, 68, 0.6);
  font-size: 12px;
  word-break: break-all;
  white-space: pre-wrap;
  line-height: 1.5;
}

.result-empty,
.result-placeholder {
  padding: 24px;
  text-align: center;
  color: var(--accent-cyan);
  font-size: 13px;
  opacity: 0.7;
  letter-spacing: 1px;
}

.typewriter-cursor {
  color: var(--accent-cyan);
  animation: blink 1s step-end infinite;
}

@keyframes blink { 50% { opacity: 0; } }
</style>
