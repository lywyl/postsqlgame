import { defineStore } from 'pinia'
import type { ExplainResult, ScanPathData, BTreeData, MvccData } from '../types'

export const useVisualStore = defineStore('visual', {
  state: () => ({
    explainData: null as ExplainResult | null,
    scanPathData: null as ScanPathData | null,
    btreeData: null as BTreeData | null,
    mvccData: null as MvccData | null,
    isExpanded: false,
  }),
  actions: {
    setExplainData(data: ExplainResult | null) {
      this.explainData = data
    },
    setScanPathData(data: ScanPathData | null) {
      this.scanPathData = data
    },
    setBtreeData(data: BTreeData | null) {
      this.btreeData = data
    },
    setMvccData(data: MvccData | null) {
      this.mvccData = data
    },
    toggleExpanded() {
      this.isExpanded = !this.isExpanded
    }
  }
})

