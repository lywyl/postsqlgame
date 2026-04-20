import type { MvccScenario, MvccSnapshot, MvccTupleVersion } from '../types'

/**
 * 在 live 元组中按 target 字段匹配（全部字段相等才匹配）
 */
function findTupleByTarget(
  tuples: MvccTupleVersion[],
  target: Record<string, unknown>
): MvccTupleVersion | null {
  const keys = Object.keys(target)
  return (
    tuples.find(
      (t) =>
        t.status === 'live' &&
        keys.every((k) => String(t.row[k]) === String(target[k]))
    ) ?? null
  )
}

/**
 * 深拷贝元组数组（避免快照共享引用）
 */
function cloneTuples(tuples: MvccTupleVersion[]): MvccTupleVersion[] {
  return tuples.map((t) => ({
    ...t,
    row: { ...t.row },
  }))
}

/**
 * MVCC 状态机：输入剧本 → 输出每一步的元组快照序列
 */
export function runMvccScenario(scenario: MvccScenario): MvccSnapshot[] {
  const snapshots: MvccSnapshot[] = []
  let xid = 100
  let ctidCounter = 0

  // 初始化：将 initialRows 作为第一批 INSERT
  const tuples: MvccTupleVersion[] = scenario.initialRows.map((row) => {
    ctidCounter++
    return {
      ctid: `(0,${ctidCounter})`,
      row: { ...row },
      xmin: xid,
      xmax: 0,
      status: 'live' as const,
    }
  })

  // 第 0 步快照：初始状态
  snapshots.push({
    stepIndex: 0,
    xid,
    operation: { op: 'INSERT', explanation: `初始数据加载 → 所有行 xmin=${xid}, xmax=0, 状态为 live` },
    tuples: cloneTuples(tuples),
    changedCtids: tuples.map((t) => t.ctid),
  })

  // 逐步执行 operations
  for (let i = 0; i < scenario.operations.length; i++) {
    const op = scenario.operations[i]
    const changedCtids: string[] = []

    switch (op.op) {
      case 'INSERT': {
        xid++
        ctidCounter++
        const newTuple: MvccTupleVersion = {
          ctid: `(0,${ctidCounter})`,
          row: { ...(op.data ?? {}) },
          xmin: xid,
          xmax: 0,
          status: 'live',
        }
        tuples.push(newTuple)
        changedCtids.push(newTuple.ctid)
        break
      }

      case 'UPDATE': {
        xid++
        if (!op.target) break
        const target = findTupleByTarget(tuples, op.target)
        if (target) {
          // 旧版本死亡
          target.xmax = xid
          target.status = 'dead'
          changedCtids.push(target.ctid)

          // 新版本诞生
          ctidCounter++
          const newTuple: MvccTupleVersion = {
            ctid: `(0,${ctidCounter})`,
            row: { ...target.row, ...(op.data ?? {}) },
            xmin: xid,
            xmax: 0,
            status: 'live',
          }
          tuples.push(newTuple)
          changedCtids.push(newTuple.ctid)
        }
        break
      }

      case 'DELETE': {
        xid++
        if (!op.target) break
        const target = findTupleByTarget(tuples, op.target)
        if (target) {
          target.xmax = xid
          target.status = 'dead'
          changedCtids.push(target.ctid)
        }
        break
      }

      case 'VACUUM': {
        // 不递增 xid
        for (const t of tuples) {
          if (t.status === 'dead') {
            t.status = 'vacuumed'
            changedCtids.push(t.ctid)
          }
        }
        break
      }
    }

    snapshots.push({
      stepIndex: i + 1,
      xid,
      operation: op,
      tuples: cloneTuples(tuples),
      changedCtids,
    })
  }

  return snapshots
}
