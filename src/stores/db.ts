import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import { PGlite } from '@electric-sql/pglite'
import type { QueryResult, ExplainResult } from '../types'
import { parseExplain } from '../utils/explainParser'

export const useDbStore = defineStore('db', {
  state: () => ({
    pg: null as PGlite | null,
    ready: false,
  }),

  actions: {
    async init() {
      if (this.ready) return
      // 使用 markRaw 避免 Vue Proxy 拦截私有字段
      const instance = new PGlite()
      await instance.waitReady
      this.pg = markRaw(instance)
      this.ready = true
    },

    async exec(sql: string): Promise<QueryResult> {
      if (!this.pg) throw new Error('Database not initialized')

      const start = performance.now()
      const result = await this.pg.query(sql)
      const duration = performance.now() - start

      return {
        columns: result.fields?.map((f) => f.name) ?? [],
        rows: (result.rows ?? []) as Record<string, unknown>[],
        rowCount: result.rows?.length ?? 0,
        duration: Math.round(duration * 100) / 100,
      }
    },

    async execMultiple(sql: string) {
      if (!this.pg) throw new Error('Database not initialized')
      await this.pg.exec(sql)
    },

    /** 执行单条查询并返回结果（不经过事务包裹），用于 needsTransaction 模式下的 checkSql */
    async queryRaw(sql: string): Promise<QueryResult> {
      if (!this.pg) throw new Error('Database not initialized')
      const start = performance.now()
      const result = await this.pg.query(sql)
      const duration = performance.now() - start
      return {
        columns: result.fields?.map((f) => f.name) ?? [],
        rows: (result.rows ?? []) as Record<string, unknown>[],
        rowCount: result.rows?.length ?? 0,
        duration: Math.round(duration * 100) / 100,
      }
    },

    async getTableData(tableName: string, columns?: string[], limit = 200): Promise<QueryResult> {
      const safeName = tableName.replace(/"/g, '""')
      const cols = columns?.length ? columns.map(c => `"${c}"`).join(', ') : '*'
      return this.exec(`SELECT ${cols} FROM "${safeName}" LIMIT ${limit}`)
    },

    /** 查询某张表上的所有用户创建的索引及其列名 */
    async getTableIndexes(tableName: string): Promise<{ indexName: string; columnName: string }[]> {
      if (!this.pg) throw new Error('Database not initialized')
      const res = await this.pg.query(`
        SELECT
          i.relname AS index_name,
          a.attname AS column_name
        FROM pg_index ix
        JOIN pg_class t ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        WHERE t.relname = $1
          AND NOT ix.indisprimary
        ORDER BY i.relname
      `, [tableName])
      return (res.rows as any[]).map(r => ({
        indexName: r.index_name,
        columnName: r.column_name
      }))
    },

    async getTableDataWithSystemColumns(tableName: string): Promise<{
      ctid: string; xmin: number; xmax: number;
      row: Record<string, unknown>
    }[]> {
      if (!this.pg) throw new Error('Database not initialized')
      const safeName = tableName.replace(/"/g, '""')
      const res = await this.pg.query(
        `SELECT *, ctid::text, xmin::text, xmax::text FROM "${safeName}"`
      )
      return (res.rows as any[]).map(r => {
        const { ctid, xmin, xmax, ...row } = r
        return { ctid: String(ctid), xmin: Number(xmin), xmax: Number(xmax), row }
      })
    },

    async explain(sql: string): Promise<ExplainResult | null> {
      if (!this.pg) throw new Error('Database not initialized')

      let transactionStarted = false
      try {
        await this.pg.exec('BEGIN;')
        transactionStarted = true
        const res = await this.pg.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`)
        return parseExplain(res.rows)
      } catch (e) {
        // 此处静默捕获：例如 DDL (CREATE TABLE) 不能被 EXPLAIN，或者 SQL 语法错误
        console.warn('Explain 解析失败或该语句不支持:', e)
        return null
      } finally {
        if (transactionStarted) {
          await this.pg.exec('ROLLBACK;').catch(() => {})
        }
      }
    },
  },
})
