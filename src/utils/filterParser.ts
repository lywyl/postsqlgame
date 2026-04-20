/**
 * Filter Parser Utility
 * Parses PostgreSQL EXPLAIN filter conditions into JavaScript evaluator functions.
 * 
 * Example input: "((citizens.salary > 10000::numeric) AND (citizens.age < 50))"
 * Output: (row) => boolean
 */

export type FilterEvaluator = (row: Record<string, unknown>) => boolean

interface ParsedCondition {
  column: string
  operator: string
  value: unknown
}

/**
 * Strip PostgreSQL type cast suffix (e.g., ::numeric, ::text, ::integer)
 */
function stripTypeCast(value: string): string {
  return value.replace(/::\w+/g, '').trim()
}

/**
 * Parse a value string into its JavaScript equivalent
 */
function parseValue(valueStr: string): unknown {
  const stripped = stripTypeCast(valueStr).trim()
  
  // NULL
  if (stripped.toUpperCase() === 'NULL') {
    return null
  }
  
  // Boolean
  if (stripped.toUpperCase() === 'TRUE') return true
  if (stripped.toUpperCase() === 'FALSE') return false
  
  // String literal (single quotes)
  if (stripped.startsWith("'") && stripped.endsWith("'")) {
    return stripped.slice(1, -1)
  }
  
  // Number
  const num = Number(stripped)
  if (!isNaN(num)) {
    return num
  }
  
  // Default: return as string
  return stripped
}

/**
 * Extract column name from a condition (removes table prefix if present)
 * e.g., "citizens.salary" -> "salary"
 */
function extractColumnName(colExpr: string): string {
  const parts = colExpr.split('.')
  return parts.length > 1 ? parts[parts.length - 1] : colExpr
}

/**
 * Parse a single condition like "citizens.salary > 10000::numeric"
 */
function parseSingleCondition(condition: string): ParsedCondition | null {
  // Match patterns like: column operator value
  // Operators: =, <>, >, <, >=, <=, IS NULL, IS NOT NULL, LIKE, ILIKE
  const patterns = [
    // IS NULL / IS NOT NULL
    {
      regex: /^(\w+(?:\.\w+)?)\s+(IS\s+NOT\s+NULL)$/i,
      parse: (m: RegExpMatchArray) => ({
        column: extractColumnName(m[1]),
        operator: 'IS NOT NULL',
        value: null
      })
    },
    {
      regex: /^(\w+(?:\.\w+)?)\s+(IS\s+NULL)$/i,
      parse: (m: RegExpMatchArray) => ({
        column: extractColumnName(m[1]),
        operator: 'IS NULL',
        value: null
      })
    },
    // LIKE / ILIKE
    {
      regex: /^(\w+(?:\.\w+)?)\s+(I?LIKE)\s+('(?:[^'\\]|\\.)*')$/i,
      parse: (m: RegExpMatchArray) => ({
        column: extractColumnName(m[1]),
        operator: m[2].toUpperCase(),
        value: parseValue(m[3])
      })
    },
    // Comparison operators
    {
      regex: /^(\w+(?:\.\w+)?)\s*([<>=!]+)\s*(.+)$/,
      parse: (m: RegExpMatchArray) => ({
        column: extractColumnName(m[1]),
        operator: m[2],
        value: parseValue(m[3])
      })
    }
  ]
  
  for (const pattern of patterns) {
    const match = condition.match(pattern.regex)
    if (match) {
      return pattern.parse(match)
    }
  }
  
  return null
}

/**
 * Evaluate a single condition against a row
 */
function evaluateCondition(condition: ParsedCondition, row: Record<string, unknown>): boolean {
  const rowValue = row[condition.column]
  
  switch (condition.operator) {
    case '=':
      return rowValue == condition.value
    case '<>':
    case '!=':
      return rowValue != condition.value
    case '>':
      return rowValue != null && condition.value != null && Number(rowValue) > Number(condition.value)
    case '<':
      return rowValue != null && condition.value != null && Number(rowValue) < Number(condition.value)
    case '>=':
      return rowValue != null && condition.value != null && Number(rowValue) >= Number(condition.value)
    case '<=':
      return rowValue != null && condition.value != null && Number(rowValue) <= Number(condition.value)
    case 'IS NULL':
      return rowValue === null || rowValue === undefined
    case 'IS NOT NULL':
      return rowValue !== null && rowValue !== undefined
    case 'LIKE':
    case 'ILIKE': {
      if (typeof rowValue !== 'string' || typeof condition.value !== 'string') return false
      const pattern = condition.value
        .replace(/%/g, '.*')
        .replace(/_/g, '.')
      const regex = condition.operator === 'ILIKE' 
        ? new RegExp(`^${pattern}$`, 'i')
        : new RegExp(`^${pattern}$`)
      return regex.test(rowValue)
    }
    default:
      return false
  }
}

/**
 * Tokenize a filter expression into conditions and operators
 * Handles parentheses, AND, OR
 */
function tokenizeFilter(filter: string): (string | 'AND' | 'OR' | '(' | ')')[] {
  const tokens: (string | 'AND' | 'OR' | '(' | ')')[] = []
  let current = ''
  let parenDepth = 0
  let inString = false
  
  for (let i = 0; i < filter.length; i++) {
    const char = filter[i]
    
    if (char === "'" && !inString) {
      inString = true
      current += char
    } else if (char === "'" && inString) {
      inString = false
      current += char
    } else if (inString) {
      current += char
    } else if (char === '(') {
      parenDepth++
      if (current.trim()) {
        tokens.push(current.trim())
        current = ''
      }
      tokens.push('(')
    } else if (char === ')') {
      parenDepth--
      if (current.trim()) {
        tokens.push(current.trim())
        current = ''
      }
      tokens.push(')')
    } else if (char === ' ' && parenDepth === 0) {
      // Check for AND/OR
      const upperCurrent = current.toUpperCase().trim()
      if (upperCurrent === 'AND') {
        tokens.push('AND')
        current = ''
      } else if (upperCurrent === 'OR') {
        tokens.push('OR')
        current = ''
      } else {
        current += char
      }
    } else {
      current += char
    }
  }
  
  if (current.trim()) {
    const upperCurrent = current.toUpperCase().trim()
    if (upperCurrent === 'AND') {
      tokens.push('AND')
    } else if (upperCurrent === 'OR') {
      tokens.push('OR')
    } else {
      tokens.push(current.trim())
    }
  }
  
  return tokens
}

/**
 * Main function: Parse a PostgreSQL filter string into a JavaScript evaluator
 * 
 * @param filter - PostgreSQL filter text from EXPLAIN (e.g., "((citizens.salary > 10000::numeric) AND (citizens.age < 50))")
 * @param _columns - Array of column names (for validation, currently unused)
 * @returns A function that evaluates the filter against a row, or null if parsing fails
 */
export function parseFilterToEvaluator(
  filter: string,
  _columns: string[]
): FilterEvaluator | null {
  try {
    const tokens = tokenizeFilter(filter)
    
    // Validate that we have meaningful tokens
    const conditionTokens = tokens.filter(t => typeof t === 'string' && t !== 'AND' && t !== 'OR' && t !== '(' && t !== ')')
    if (conditionTokens.length === 0) {
      return null
    }
    
    return (row: Record<string, unknown>) => {
      try {
        const tokensCopy = [...tokens]
        let pos = 0
        
        function parseExpression(): boolean {
          let left = parseAndExpression()
          
          while (pos < tokensCopy.length && tokensCopy[pos] === 'OR') {
            pos++
            const right = parseAndExpression()
            left = left || right
          }
          
          return left
        }
        
        function parseAndExpression(): boolean {
          let left = parsePrimary()
          
          while (pos < tokensCopy.length && tokensCopy[pos] === 'AND') {
            pos++
            const right = parsePrimary()
            left = left && right
          }
          
          return left
        }
        
        function parsePrimary(): boolean {
          const token = tokensCopy[pos]
          
          if (token === '(') {
            pos++
            const result = parseExpression()
            pos++
            return result
          }
          
          if (typeof token === 'string' && token !== 'AND' && token !== 'OR' && token !== '(' && token !== ')') {
            pos++
            const condition = parseSingleCondition(token)
            if (condition) {
              return evaluateCondition(condition, row)
            }
            return true
          }
          
          pos++
          return true
        }
        
        return parseExpression()
      } catch {
        return true
      }
    }
  } catch {
    return null
  }
}

/**
 * Check if a row matches an index condition
 * Similar to filter evaluation but for indexCond
 */
export function parseIndexCondToEvaluator(
  indexCond: string,
  _columns: string[]
): FilterEvaluator | null {
  // Index conditions have similar format to filters
  return parseFilterToEvaluator(indexCond, _columns)
}
