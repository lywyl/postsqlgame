<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { Codemirror } from 'vue-codemirror'
import { sql } from '@codemirror/lang-sql'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { history, historyKeymap, undo, redo } from '@codemirror/commands'

const emit = defineEmits<{
  execute: [sql: string]
}>()

const code = ref('')
const view = shallowRef<EditorView>()
const isExecuting = ref(false)

function handleExecute() {
  if (isExecuting.value || !code.value.trim()) return
  isExecuting.value = true
  emit('execute', code.value)
  // 2秒后自动重置（防止卡死）
  setTimeout(() => { isExecuting.value = false }, 2000)
}

// 父组件可在执行完成后调用此方法重置状态
function resetExecuting() {
  isExecuting.value = false
}

const executeKeymap = Prec.highest(
  keymap.of([
    {
      key: 'Ctrl-Enter',
      mac: 'Meta-Enter',
      run: () => {
        handleExecute()
        return true
      },
    },
  ])
)

const extensions = [sql(), oneDark, EditorView.lineWrapping, history(), executeKeymap, keymap.of(historyKeymap)]

function handleReady(payload: { view: EditorView }) {
  view.value = payload.view
}

defineExpose({
  getCode: () => code.value,
  setCode: (val: string) => { code.value = val },
  undo: () => { if (view.value) undo(view.value) },
  redo: () => { if (view.value) redo(view.value) },
  resetExecuting,
})
</script>

<template>
  <div class="sql-editor">
    <div class="editor-header">
      <span class="terminal-title">TERMINAL // SQL_OVERRIDE</span>
    </div>
    <Codemirror
      v-model="code"
      class="custom-cm"
      :extensions="extensions"
      :style="{ flex: 1, minHeight: '80px' }"
      @ready="handleReady"
    />
    <div class="editor-toolbar">
      <div class="toolbar-history">
        <button class="btn-history" @click="view && undo(view)" title="撤销 (Ctrl+Z)">↶</button>
        <button class="btn-history" @click="view && redo(view)" title="重做 (Ctrl+Y)">↷</button>
      </div>
      <button class="btn-execute" :class="{ executing: isExecuting }" @click="handleExecute">
        {{ isExecuting ? 'PROCESSING...' : '> EXECUTE_QUERY (Ctrl+Enter)' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.sql-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: transparent;
  border-radius: 8px;
  overflow: hidden;
}

.editor-header {
  padding: 6px 12px;
  background: rgba(16, 185, 129, 0.1);
  border-bottom: 1px solid var(--accent-soft);
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  letter-spacing: 1px;
}

:deep(.custom-cm) {
  background-color: transparent !important;
  font-family: var(--mono);
  font-size: 14px;
}

:deep(.cm-editor) {
  background-color: transparent !important;
}

:deep(.cm-scroller) {
  font-family: var(--mono);
  overflow: auto;
}

:deep(.cm-focused) {
  outline: none !important;
}

.editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(15, 23, 42, 0.4);
  border-top: 1px solid var(--border);
}

.toolbar-history {
  display: flex;
  gap: 4px;
}

.btn-history {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border);
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  opacity: 0.5;
}

.btn-history:hover {
  opacity: 1;
  border-color: var(--accent-cyan);
  color: var(--accent-cyan);
}

.btn-execute {
  background: transparent;
  color: var(--accent);
  border: 1px solid var(--accent);
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s;
  text-transform: uppercase;
}

.btn-execute:hover {
  background: var(--accent);
  color: #000;
  box-shadow: 0 0 15px var(--accent-soft);
}

.btn-execute.executing {
  animation: glitch 0.3s linear infinite;
  border-color: var(--accent-cyan);
  color: var(--accent-cyan);
  pointer-events: none;
}

@keyframes glitch {
  0% { transform: translate(0); text-shadow: none; }
  20% { transform: translate(-1px, 1px); text-shadow: 1px 0 var(--accent), -1px 0 var(--accent-purple); }
  40% { transform: translate(1px, -1px); text-shadow: -1px 0 var(--accent-cyan), 1px 0 var(--accent); }
  60% { transform: translate(-1px, 0); text-shadow: 1px 0 var(--accent-purple), -1px 0 var(--accent-cyan); }
  80% { transform: translate(1px, 1px); text-shadow: -1px 0 var(--accent), 1px 0 var(--accent); }
  100% { transform: translate(0); text-shadow: none; }
}
</style>
