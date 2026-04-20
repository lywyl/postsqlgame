// TODO: 未启用章节，章节 ID 需重新编号后才能接入 chapters.ts
import type { Chapter } from '../../types'
import { FULL_WORLD_WITH_BUILDINGS_SQL, FULL_WORLD_WITH_DOCUMENTS_SQL } from '../world/init'

export const ch14: Chapter = {
  id: 'ch14',
  title: '第 14 章：数据特工',
  description: 'JSON / 全文搜索 / 数组：JSONB查询 / GIN索引 / tsvector / tsquery / 数组操作',
  icon: '🔍',
  levels: [
    {
      id: 'ch14-1',
      title: 'JSON 解析',
      description: 'ZERO: "市长 Orion 把机密信息藏在了居民的 profile 字段里——那是一个 JSONB 列。要提取这些情报，你需要学会在 JSON 迷宫中导航。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL + `
ALTER TABLE citizens ADD COLUMN IF NOT EXISTS profile JSONB;
ALTER TABLE citizens ADD COLUMN IF NOT EXISTS skills TEXT[];
UPDATE citizens SET 
  profile = jsonb_build_object(
    'level', (id % 5 + 1),
    'department', job,
    'clearance', CASE WHEN salary > 25000 THEN 'top_secret' WHEN salary > 15000 THEN 'confidential' ELSE 'public' END,
    'projects', jsonb_build_array('project_' || (id % 3 + 1), 'project_' || (id % 4 + 5))
  ),
  skills = ARRAY[job, CASE WHEN id % 2 = 0 THEN '数据分析' ELSE '系统操作' END]::TEXT[]
WHERE profile IS NULL;
`,
      defaultSql: "SELECT name, profile->>'department' as dept, profile->>'clearance' as clearance FROM citizens WHERE profile IS NOT NULL ORDER BY salary DESC LIMIT 10;",
      tasks: [
        {
          prompt: 'ZERO: "JSONB 数据就像嵌套的保险箱。->> 操作符可以提取文本值，让我看看居民档案里的部门信息和安全等级。"\n\n查询所有有 profile 数据的居民，显示姓名、部门（profile->>\'department\'）和安全等级（profile->>\'clearance\'），按薪水降序排列，取前10条。',
          answerSql: "SELECT name, profile->>'department' as dept, profile->>'clearance' as clearance FROM citizens WHERE profile IS NOT NULL ORDER BY salary DESC LIMIT 10;",
          hints: [
            "->> 操作符提取 JSONB 字段的文本值：profile->>'key'",
            "使用别名让输出更清晰：profile->>'department' as dept",
            "SELECT name, profile->>'department' as dept, profile->>'clearance' as clearance FROM citizens WHERE profile IS NOT NULL ORDER BY salary DESC LIMIT 10;"
          ],
          successStory: 'ZERO: "JSON 解析成功。profile->>\'clearance\' 提取出了安全等级——top_secret、confidential、public。看来 Orion 把最高机密藏在了高薪居民的档案里。继续深入挖掘。"'
        },
        {
          prompt: 'ZERO: "@> 操作符可以检查 JSONB 是否包含特定的键值对。让我找出所有拥有 top_secret 安全等级的居民——他们可能是 Orion 的核心圈子。"\n\n使用 @> 操作符查询 profile 中包含 {"clearance": "top_secret"} 的居民，显示姓名和薪水。',
          answerSql: "SELECT name, salary FROM citizens WHERE profile @> '{\"clearance\": \"top_secret\"}'::jsonb;",
          hints: [
            "@> 是 JSONB 包含操作符：检查左侧 JSONB 是否包含右侧的键值对",
            "右侧需要用 ::jsonb 转换为 JSONB 类型",
            "SELECT name, salary FROM citizens WHERE profile @> '{\"clearance\": \"top_secret\"}'::jsonb;"
          ],
          successStory: 'ZERO: "找到了！这些 top_secret 级别的居民都是城市的高层——CTO、副总、总经理。Orion 的机密网络正在浮出水面。"'
        },
        {
          prompt: 'ZERO: "最后一招——jsonb_agg 可以把多行聚合成 JSONB 数组。让我看看每个区都有哪些居民。"\n\n使用 jsonb_agg 按区聚合居民姓名，显示区名和居民姓名数组，按区名排序。',
          answerSql: "SELECT d.district_name, jsonb_agg(c.name ORDER BY c.salary DESC) as citizen_names FROM citizens c JOIN districts d ON c.district_id = d.id GROUP BY d.district_name ORDER BY d.district_name;",
          hints: [
            "jsonb_agg(列 ORDER BY ...) 可以按指定顺序聚合 JSONB 数组",
            "JOIN districts 获取区名，GROUP BY 按区分组",
            "SELECT d.district_name, jsonb_agg(c.name ORDER BY c.salary DESC) as citizen_names FROM citizens c JOIN districts d ON c.district_id = d.id GROUP BY d.district_name ORDER BY d.district_name;"
          ],
          successStory: 'ZERO: "JSON 聚合完成。jsonb_agg 把每个区的居民姓名打包成了 JSONB 数组。JSONB 的强大之处在于它既能存储复杂结构，又能用 SQL 灵活查询。下一关，我们要建立索引来加速这些查询。"'
        }
      ]
    },
    {
      id: 'ch14-2',
      title: 'JSON 查询',
      description: 'ZERO: "JSONB 查询如果没有索引支持，每次都要全表扫描。GIN 索引是 JSONB 的最佳搭档——它可以索引 JSONB 中的所有键值对，让查询飞起来。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL + `
ALTER TABLE citizens ADD COLUMN IF NOT EXISTS profile JSONB;
UPDATE citizens SET 
  profile = jsonb_build_object(
    'level', (id % 5 + 1),
    'department', job,
    'clearance', CASE WHEN salary > 25000 THEN 'top_secret' WHEN salary > 15000 THEN 'confidential' ELSE 'public' END,
    'projects', jsonb_build_array('project_' || (id % 3 + 1), 'project_' || (id % 4 + 5))
  )
WHERE profile IS NULL;
`,
      defaultSql: "CREATE INDEX idx_citizens_profile ON citizens USING GIN (profile);",
      tasks: [
        {
          prompt: 'ZERO: "GIN（Generalized Inverted Index）索引专为多值数据设计，是 JSONB 的最佳索引类型。让我们在 profile 列上建立 GIN 索引。"\n\n为 citizens 表的 profile 列创建 GIN 索引，命名为 idx_citizens_profile。',
          answerSql: "CREATE INDEX idx_citizens_profile ON citizens USING GIN (profile);",
          checkSql: "SELECT indexname FROM pg_indexes WHERE tablename = 'citizens' AND indexname = 'idx_citizens_profile';",
          hints: [
            "GIN 索引语法：CREATE INDEX 索引名 ON 表名 USING GIN (列名);",
            "GIN 索引支持 JSONB 的 @>, ?, ?|, ?& 等操作符",
            "CREATE INDEX idx_citizens_profile ON citizens USING GIN (profile);"
          ],
          needsTransaction: true,
          successStory: 'ZERO: "GIN 索引已建立。现在 @> 查询可以利用索引快速定位，而不需要扫描全表。GIN 索引会提取 JSONB 中的所有键值对，建立倒排索引——这是处理半结构化数据的利器。"'
        },
        {
          prompt: 'ZERO: "现在用索引加速查询——找出参与 project_alpha 项目的所有居民。projects 是一个 JSONB 数组，我们可以用 @> 检查数组是否包含特定元素。"\n\n查询 profile->\'projects\' 数组中包含 "project_1" 的居民，显示姓名和项目列表。',
          answerSql: "SELECT name, profile->'projects' as projects FROM citizens WHERE profile->'projects' @> '\"project_1\"'::jsonb;",
          hints: [
            "-> 操作符返回 JSONB 值（不是文本），可以继续用 @> 查询",
            "字符串值需要用 \"...\" 包裹后再转 jsonb",
            "SELECT name, profile->'projects' as projects FROM citizens WHERE profile->'projects' @> '\"project_1\"'::jsonb;"
          ],
          successStory: 'ZERO: "项目查询完成。profile->\'projects\' 返回 JSONB 数组，然后用 @> 检查是否包含特定项目。有了 GIN 索引，这种查询在数百万行数据上也能毫秒级响应。Orion 的项目网络图正在成形。"'
        }
      ]
    },
    {
      id: 'ch14-3',
      title: '全文搜索',
      description: 'ZERO: "城市文档库里藏着 Orion 的秘密。但文档是自由文本，普通索引无法搜索其中的关键词。全文搜索（Full-Text Search）可以把文本转换成可搜索的 tsvector，用 tsquery 进行语义匹配。"',
      initSql: FULL_WORLD_WITH_DOCUMENTS_SQL,
      defaultSql: "SELECT title FROM documents WHERE to_tsvector('simple', content) @@ to_tsquery('simple', '量子');",
      tasks: [
        {
          prompt: 'ZERO: "to_tsvector 把文本分解成词元（token），to_tsquery 把搜索词转换成查询条件，@@ 操作符检查是否匹配。让我们搜索包含"量子"的文档。"\n\n使用 to_tsvector 和 to_tsquery 查询 content 中包含"量子"的文档，显示标题。',
          answerSql: "SELECT title FROM documents WHERE to_tsvector('simple', content) @@ to_tsquery('simple', '量子');",
          hints: [
            "to_tsvector('simple', 文本) 把文本转换成搜索向量",
            "to_tsquery('simple', '关键词') 把关键词转换成查询条件",
            "SELECT title FROM documents WHERE to_tsvector('simple', content) @@ to_tsquery('simple', '量子');"
          ],
          successStory: 'ZERO: "全文搜索成功！to_tsvector 把文档内容拆分成词元列表，to_tsquery 把搜索词转换成查询树，@@ 操作符执行匹配。这比 LIKE %量子% 高效得多，尤其是文档量很大时。"'
        },
        {
          prompt: 'ZERO: "每次查询都用 to_tsvector 实时转换效率太低。让我们添加一个 tsvector 列，建立 GIN 索引，预先计算好搜索向量。"\n\n执行以下操作：\n1. ALTER TABLE documents ADD COLUMN search_vector TSVECTOR;\n2. UPDATE documents SET search_vector = to_tsvector(\'simple\', coalesce(title,\'\') || \' \' || coalesce(content,\'\'));\n3. CREATE INDEX idx_documents_search ON documents USING GIN (search_vector);',
          answerSql: "ALTER TABLE documents ADD COLUMN search_vector TSVECTOR;\nUPDATE documents SET search_vector = to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,''));\nCREATE INDEX idx_documents_search ON documents USING GIN (search_vector);",
          checkSql: "SELECT indexname FROM pg_indexes WHERE tablename = 'documents' AND indexname = 'idx_documents_search';",
          hints: [
            "coalesce(title,'') 把 NULL 替换成空字符串，避免 to_tsvector 返回 NULL",
            "GIN 索引是全文搜索的最佳搭档",
            "ALTER TABLE documents ADD COLUMN search_vector TSVECTOR;\nUPDATE documents SET search_vector = to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,''));\nCREATE INDEX idx_documents_search ON documents USING GIN (search_vector);"
          ],
          needsTransaction: true,
          successStory: 'ZERO: "全文搜索基础设施已就位。search_vector 列存储预计算的 tsvector，GIN 索引加速查询。现在搜索文档只需要检查索引，不需要实时解析文本。这是生产环境的标准做法。"'
        },
        {
          prompt: 'ZERO: "现在用新建立的搜索向量查询机密文档。搜索同时包含"调查"和"港口"的机密文档（classified = \'classified\'）。"\n\n使用 search_vector 列查询包含"调查 & 港口"且 classified = \'classified\' 的文档，显示标题和分类。',
          answerSql: "SELECT title, category FROM documents WHERE search_vector @@ to_tsquery('simple', '调查 & 港口') AND classified = 'classified';",
          hints: [
            "& 表示 AND，| 表示 OR，! 表示 NOT",
            "to_tsquery 支持布尔逻辑：'调查 & 港口' 表示同时包含两个词",
            "SELECT title, category FROM documents WHERE search_vector @@ to_tsquery('simple', '调查 & 港口') AND classified = 'classified';"
          ],
          successStory: 'ZERO: "找到了！港口区走私调查报告——这是一份 classified 级别的机密文件。全文搜索的布尔逻辑让我们可以精确组合多个关键词。Orion 的秘密正在浮出水面。"'
        }
      ]
    },
    {
      id: 'ch14-4',
      title: '搜索排序',
      description: 'ZERO: "找到相关文档只是第一步。真正的情报分析需要按相关性排序，并高亮显示匹配的关键词。ts_rank 和 ts_headline 让搜索结果更智能。"',
      initSql: FULL_WORLD_WITH_DOCUMENTS_SQL + `
ALTER TABLE documents ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;
UPDATE documents SET search_vector = to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,''));
CREATE INDEX IF NOT EXISTS idx_documents_search ON documents USING GIN (search_vector);
`,
      defaultSql: "SELECT title, ts_rank(search_vector, to_tsquery('simple', '安全')) AS rank FROM documents WHERE search_vector @@ to_tsquery('simple', '安全') ORDER BY rank DESC;",
      tasks: [
        {
          prompt: 'ZERO: "搜索返回了很多结果，但哪些最相关？ts_rank 函数可以根据词频和位置计算相关性分数，让我们按重要程度排序。"\n\n使用 ts_rank 查询包含"安全"的文档，并按相关性降序排列。显示标题和相关性分数。',
          answerSql: "SELECT title, ts_rank(search_vector, to_tsquery('simple', '安全')) AS rank FROM documents WHERE search_vector @@ to_tsquery('simple', '安全') ORDER BY rank DESC;",
          hints: [
            "ts_rank(向量, 查询) 返回相关性分数，范围通常是 0 到 1",
            "ORDER BY rank DESC 让最相关的结果排在前面",
            "SELECT title, ts_rank(search_vector, to_tsquery('simple', '安全')) AS rank FROM documents WHERE search_vector @@ to_tsquery('simple', '安全') ORDER BY rank DESC;"
          ],
          successStory: 'ZERO: "相关性排序完成。ts_rank 考虑了词频、词距等因素——标题中出现的关键词比正文中出现的权重更高。现在情报分析员可以优先查看最相关的文档了。"'
        },
        {
          prompt: 'ZERO: "最后一步——ts_headline 可以在搜索结果中高亮显示匹配的关键词，让分析员快速定位关键信息。"\n\n使用 ts_headline 查询包含"数据"的文档，高亮显示匹配的关键词，限制返回5条。',
          answerSql: "SELECT title, ts_headline('simple', content, to_tsquery('simple', '数据')) FROM documents WHERE search_vector @@ to_tsquery('simple', '数据') LIMIT 5;",
          hints: [
            "ts_headline(配置, 文本, 查询) 返回带高亮标记的文本片段",
            "匹配的关键词会被 <b>...</b> 标签包裹（可在前端渲染为高亮）",
            "SELECT title, ts_headline('simple', content, to_tsquery('simple', '数据')) FROM documents WHERE search_vector @@ to_tsquery('simple', '数据') LIMIT 5;"
          ],
          successStory: 'ZERO: "情报提取系统已完全激活。ts_headline 自动提取包含匹配词的上下文片段，并用标记包裹关键词。全文搜索的三件套——tsvector 存储、tsquery 查询、ts_rank/ts_headline 展示——已经全部就位。市长 Orion 的秘密文档，现在无所遁形。"'
        }
      ]
    },
    {
      id: 'ch14-5',
      title: '数组操作',
      description: 'ZERO: "居民的技能标签存储在 TEXT[] 数组中。数组操作符和函数可以高效地查询和分析这些标签数据——找出拥有特定技能的人，或者统计每个区的技能分布。"',
      initSql: FULL_WORLD_WITH_BUILDINGS_SQL + `
ALTER TABLE citizens ADD COLUMN IF NOT EXISTS skills TEXT[];
UPDATE citizens SET skills = ARRAY[job, '数据分析', '系统操作']::TEXT[] WHERE id % 3 = 0;
UPDATE citizens SET skills = ARRAY[job, '项目管理', '团队协作']::TEXT[] WHERE id % 3 = 1;
UPDATE citizens SET skills = ARRAY[job, '安全审计', '风险评估']::TEXT[] WHERE id % 3 = 2;
`,
      defaultSql: "SELECT name, skills FROM citizens WHERE skills @> ARRAY['程序员']::TEXT[];",
      tasks: [
        {
          prompt: 'ZERO: "数组操作符 @> 可以检查数组是否包含特定元素。让我们找出所有拥有"程序员"技能的居民。"\n\n使用 @> 操作符查询 skills 数组包含"程序员"的居民，显示姓名和技能列表。',
          answerSql: "SELECT name, skills FROM citizens WHERE skills @> ARRAY['程序员']::TEXT[];",
          hints: [
            "@> 是数组包含操作符：ARRAY['a','b'] @> ARRAY['a'] 返回 true",
            "右侧必须用 ARRAY[...]::TEXT[] 明确指定数组类型",
            "SELECT name, skills FROM citizens WHERE skills @> ARRAY['程序员']::TEXT[];"
          ],
          successStory: 'ZERO: "数组包含查询成功。@> 操作符会检查左侧数组是否完全包含右侧数组的所有元素。这是查询标签数组最高效的方式——比用 ANY 或字符串匹配快得多。"'
        },
        {
          prompt: 'ZERO: "最后挑战——使用 array_agg 和 unnest 进行高级数组操作。array_agg 可以将多行聚合成数组，unnest 可以将数组展开成多行。"\n\n查询每个区的居民姓名列表（用 array_agg 聚合），并按区名排序。',
          answerSql: "SELECT d.district_name, array_agg(c.name ORDER BY c.salary DESC) AS residents FROM citizens c JOIN districts d ON c.district_id = d.id GROUP BY d.district_name ORDER BY d.district_name;",
          hints: [
            "array_agg(列 ORDER BY ...) 可以按指定顺序聚合数组元素",
            "JOIN districts 获取区名，GROUP BY 按区分组",
            "SELECT d.district_name, array_agg(c.name ORDER BY c.salary DESC) AS residents FROM citizens c JOIN districts d ON c.district_id = d.id GROUP BY d.district_name ORDER BY d.district_name;"
          ],
          successStory: 'ZERO: "数组操作已完全掌握。array_agg 把多行聚合成数组，unnest 把数组展开成多行——这两个函数配合，可以在行式和列式表示之间自由转换。JSON、全文搜索、数组——Neo-Postgres 的高级数据类型已经全部解锁。市长 Orion 的数据堡垒，现在对你完全透明。"\n\nAlice: "太棒了！你已经掌握了 PostgreSQL 的高级数据类型。JSONB 存储结构化数据，全文搜索处理非结构化文本，数组管理标签集合——这些是现代数据库应用的核心技能。"\n\nMayor Orion: "哼……就算你能读取数据，也不代表你能理解真相。ZERO，我们的较量才刚刚开始。"\n\nZERO: "我等着你的下一招，Orion。"'
        }
      ]
    }
  ]
}
