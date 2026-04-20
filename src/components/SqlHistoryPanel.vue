<script setup lang="ts">
import { ref } from 'vue'
import type { SqlExecutionHistoryItem } from '../types'

defineProps<{
  items: SqlExecutionHistoryItem[]
}>()

const emit = defineEmits<{
  restore: [sql: string]
}>()

const collapsed = ref(false)

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function truncate(sql: string, max = 60): string {
  const trimmed = sql.trim().replace(/\s+/g, ' ')
  return trimmed.length > max ? trimmed.slice(0, max) + '…' : trimmed
}
</script>

<template>
  <div class="sql-history">
    <div class="history-header" @click="collapsed = !collapsed">
      <span class="history-title">⟳ SQL 执行历史</span>
      <span class="history-toggle">{{ collapsed ? '▲' : '▼' }}</span>
    </div>

    <div v-if="!collapsed" class="history-body">
      <div v-if="items.length === 0" class="history-empty">
        暂无执行记录
      </div>

      <div
        v-for="item in items"
        :key="item.id"
        class="history-item"
        :class="{ success: item.success, failed: !item.success }"
        @click="emit('restore', item.sql)"
      >
        <div class="history-item-left">
          <span class="history-status">{{ item.success ? '✓' : '✗' }}</span>
          <span class="history-time">{{ formatTime(item.timestamp) }}</span>
        </div>
        <div class="history-sql">{{ truncate(item.sql) }}</div>
        <div v-if="item.errorSummary" class="history-error">{{ item.errorSummary }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sql-history {
  font-family: var(--mono);
  border-top: 1px solid var(--border);
  background: rgba(15, 23, 42, 0.3);
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.history-header:hover {
  background: rgba(6, 182, 212, 0.05);
}

.history-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-cyan);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.history-toggle {
  font-size: 10px;
  color: var(--text);
  opacity: 0.5;
}

.history-body {
  max-height: 200px;
  overflow-y: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.history-empty {
  padding: 16px 12px;
  font-size: 12px;
  color: var(--text);
  opacity: 0.4;
  text-align: center;
}

.history-item {
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: background 0.15s;
}

.history-item:hover {
  background: rgba(6, 182, 212, 0.08);
}

.history-item-left {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.history-status {
  font-size: 12px;
  font-weight: 700;
}

.history-item.success .history-status {
  color: #10b981;
}

.history-item.failed .history-status {
  color: #ef4444;
}

.history-time {
  font-size: 10px;
  color: var(--text);
  opacity: 0.4;
}

.history-sql {
  font-size: 12px;
  color: var(--text-h);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-error {
  font-size: 10px;
  color: #ef4444;
  opacity: 0.7;
  margin-top: 2px;
}
</style>
