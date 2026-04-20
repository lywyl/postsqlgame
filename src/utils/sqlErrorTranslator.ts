import type { SqlDisplayError } from '../types'

interface ErrorRule {
  key: string
  regex: RegExp
  toMessage: (match: RegExpMatchArray, raw: string) => string
}

/**
 * 有序错误规则列表 — 从具体到通用
 * 按顺序匹配，命中即返回
 */
const errorRules: ErrorRule[] = [
  {
    key: 'column_not_found',
    regex: /column\s+"([^"]+)"\s+does not exist/i,
    toMessage: (m) => `你引用了一个不存在的列 "${m[1]}"，检查一下拼写或表结构？`,
  },
  {
    key: 'relation_not_found',
    regex: /relation\s+"([^"]+)"\s+does not exist/i,
    toMessage: (m) => `表 "${m[1]}" 不存在，确认表名是否正确？可以用 SELECT * FROM pg_tables 查看所有表。`,
  },
  {
    key: 'syntax_error',
    regex: /syntax error at or near\s+"([^"]+)"/i,
    toMessage: (m) => `SQL 语法错误在 "${m[1]}" 附近，检查一下关键字拼写和语句结构。`,
  },
  {
    key: 'operator_not_exist',
    regex: /operator does not exist:\s+(\S+)/i,
    toMessage: (m) => `操作符不适用于当前数据类型 (${m[1]})，可能需要使用类型转换（如 CAST 或 ::）？`,
  },
  {
    key: 'aggregate_in_where',
    regex: /aggregates not allowed in\s+WHERE/i,
    toMessage: () => '聚合函数（如 COUNT、AVG）不能用在 WHERE 子句中。试试用 HAVING 来过滤分组后的结果。',
  },
  {
    key: 'group_by_error',
    regex: /must appear in the GROUP BY clause/i,
    toMessage: () => 'SELECT 中的非聚合列必须出现在 GROUP BY 中，或者用聚合函数包裹。',
  },
  {
    key: 'division_by_zero',
    regex: /division by zero/i,
    toMessage: () => '除数不能为零！检查一下你的数学表达式，确保分母不为零。',
  },
  {
    key: 'null_value_not_null',
    regex: /null value in column\s+"([^"]+)"\s+violates not-null constraint/i,
    toMessage: (m) => `列 "${m[1]}" 不允许为 NULL，插入数据时必须给它一个值。`,
  },
  {
    key: 'duplicate_key',
    regex: /duplicate key value violates unique constraint/i,
    toMessage: () => '插入的数据违反了唯一约束——有重复的键值。检查是否已存在相同的主键或唯一索引。',
  },
  {
    key: 'foreign_key_violation',
    regex: /insert or update on table\s+"[^"]+"\s+violates foreign key constraint/i,
    toMessage: () => '外键约束被违反——你引用的记录不存在。先确保被引用的表中存在对应记录。',
  },
  {
    key: 'check_violation',
    regex: /new row for relation\s+"[^"]+"\s+violates check constraint/i,
    toMessage: () => '数据不满足 CHECK 约束条件。检查一下值是否在允许的范围内。',
  },
  {
    key: 'permission_denied',
    regex: /permission denied/i,
    toMessage: () => '权限不足——当前用户没有执行此操作的权限。确认角色和 GRANT 设置。',
  },
  {
    key: 'too_many_arguments',
    regex: /function\s+"[^"]+"\s+does not exist/i,
    toMessage: (_m, raw) => {
      const hint = raw.match(/Hint:\s*(.+)/i)
      if (hint) {
        return `函数调用可能参数不匹配。${hint[1]}`
      }
      return '函数不存在或参数数量/类型不正确，检查函数签名。'
    },
  },
  {
    key: 'invalid_datetime_format',
    regex: /invalid input syntax for (?:type\s+)?(?:timestamp|date|time)/i,
    toMessage: () => '日期/时间格式不正确。PostgreSQL 接受的格式如：\'2025-01-15\' 或 \'2025-01-15 10:30:00\'。',
  },
  {
    key: 'invalid_numeric',
    regex: /invalid input syntax for (?:type\s+)?(?:integer|numeric|real|double)/i,
    toMessage: () => '数字格式不正确。确保输入的是有效的数值。',
  },
  {
    key: 'undefined_table',
    regex: /missing FROM-clause entry for table/i,
    toMessage: () => 'FROM 子句中缺少表引用。检查是否在 JOIN 或子查询中遗漏了表名。',
  },
  {
    key: 'ambiguous_column',
    regex: /column reference\s+"([^"]+)"\s+is ambiguous/i,
    toMessage: (m) => `列 "${m[1]}" 有歧义——多张表都有这个列名。使用 表名.列名 来明确指定。`,
  },
  {
    key: 'generic_syntax',
    regex: /syntax error/i,
    toMessage: () => 'SQL 语法错误，检查关键字拼写、括号匹配和逗号分隔。',
  },
]

/**
 * 将原始 PGlite 错误翻译为教学化中文提示
 * @param raw 原始错误消息
 * @returns SqlDisplayError 包含友好提示和原始消息
 */
export function translateSqlError(raw: string): SqlDisplayError {
  const rawStr = typeof raw === 'string' ? raw : String(raw)

  for (const rule of errorRules) {
    const match = rawStr.match(rule.regex)
    if (match) {
      return {
        friendlyMessage: rule.toMessage(match, rawStr),
        rawMessage: rawStr,
        ruleKey: rule.key,
      }
    }
  }

  // 兜底：未识别的错误
  return {
    friendlyMessage: '发生了未知错误：' + rawStr.slice(0, 100),
    rawMessage: rawStr,
    ruleKey: 'unknown',
  }
}
