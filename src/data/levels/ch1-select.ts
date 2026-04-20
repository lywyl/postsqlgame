import type { Chapter } from '../../types'
import { CITIZENS_SIMPLE_SQL } from '../world/citizens'

export const ch1: Chapter = {
  id: 'ch1',
  title: '第 1 章：城市档案馆',
  description: 'SELECT 与数据探索',
  icon: '📗',
  levels: [
    {
      id: 'ch1-1',
      title: '初来乍到',
      description: 'Alice: "代号 Query_Unit_73，我是安全局的 Alice。这是你作为探针连接城市数据库的第一天。先拿 citizens（居民表）练练手。"',
      initSql: CITIZENS_SIMPLE_SQL,
      defaultSql: 'SELECT * FROM citizens;',
      tasks: [
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district, job, salary)\n\n查询 citizens 表中的所有记录',
          answerSql: 'SELECT * FROM citizens;',
          hints: [
            '使用 SELECT 语句查询表中的数据',
            'SELECT * 表示选择所有列',
            'SELECT * FROM citizens;',
          ],
          successStory: 'Alice: "很好。这就是这座城市的基础数据阵列。所有的居民都被编码在这个表里。"',
        },
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district, job, salary)\n\n只查询居民的 name 和 salary 列',
          answerSql: 'SELECT name, salary FROM citizens;',
          hints: [
            'SELECT 后面可以指定列名，用逗号分隔',
            'SELECT name, salary FROM ...',
            'SELECT name, salary FROM citizens;',
          ],
          successStory: 'Alice: "你学会了提取指定维度的特征流。这是查询的基本功。"',
        },
      ],
      mvccScenario: {
        tableName: 'citizens',
        columns: ['id', 'name', 'age', 'district', 'job', 'salary'],
        initialRows: [
          { id: 1, name: '张伟', age: 28, district: '东区', job: '程序员', salary: 15000 },
          { id: 2, name: '李娜', age: 35, district: '西区', job: '教师', salary: 8500 },
          { id: 3, name: '王强', age: 42, district: '东区', job: '医生', salary: 22000 },
        ],
        operations: [
          {
            op: 'INSERT',
            data: { id: 9, name: '新居民', age: 30, district: '东区', job: '工程师', salary: 16000 },
            explanation: '事务 #101 插入新行 → 新元组 xmin=101, xmax=0, 状态为 live',
          },
          {
            op: 'UPDATE',
            target: { id: 2 },
            data: { salary: 12000 },
            explanation: '事务 #102 更新李娜薪资 → 旧版本 xmax=102 变为 dead，新版本 xmin=102 为 live',
          },
          {
            op: 'DELETE',
            target: { id: 3 },
            explanation: '事务 #103 删除王强 → 该元组 xmax=103, 变为 dead（但物理上仍在堆中）',
          },
          {
            op: 'VACUUM',
            explanation: 'VACUUM 回收 dead 元组占用的空间 → dead 行标记为 vacuumed，空间可被复用',
          },
        ],
      },
    },
    {
      id: 'ch1-2',
      title: '定向搜索',
      description: 'Alice: "不要盲目倾泻数据，内网信道有带宽阈值。市长防卫队需要东区的公民白名单。用 WHERE 加上精确的探针逻辑卡过去。"',
      initSql: CITIZENS_SIMPLE_SQL,
      defaultSql: "SELECT * FROM citizens WHERE district = '东区';",
      tasks: [
        {
          prompt: "📋 数据参考：表 citizens (id, name, age, district, job, salary)\n\n查询住在东区（district = '东区'）的所有居民",
          answerSql: "SELECT * FROM citizens WHERE district = '东区';",
          hints: [
            '你需要过滤行，使用 WHERE 子句',
            "WHERE district = '东区'",
            "SELECT * FROM citizens WHERE district = '东区';",
          ],
          successStory: 'Alice: "精确定位。这可以帮我们过滤掉不需要的噪音数据。"',
        },
        {
          prompt: "📋 数据参考：表 citizens (id, name, age, district, job, salary)\n\n查询住在东区且月薪超过 15000 的居民姓名和薪资",
          answerSql: "SELECT name, salary FROM citizens WHERE district = '东区' AND salary > 15000;",
          hints: [
            '使用 AND 连接多个条件',
            "WHERE district = '东区' AND salary > 15000",
            "SELECT name, salary FROM citizens WHERE district = '东区' AND salary > 15000;",
          ],
          successStory: 'Alice: "这几个人是高级特权阶层。请不要向外界透露他们的薪资数据。"',
        },
      ],
    },
    {
      id: 'ch1-3',
      title: '范围筛选',
      description: 'Alice: "中央处理器正在分配重体力劳工指标。我们需要卡准 25 到 40 岁的生理特征区间，用 BETWEEN 或 IN 枚举列表圈定合法耗材。"',
      initSql: CITIZENS_SIMPLE_SQL,
      defaultSql: 'SELECT * FROM citizens WHERE age BETWEEN 25 AND 40;',
      tasks: [
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district, job, salary)\n\n查询年龄在 25 到 40 岁之间（含）的所有居民',
          answerSql: 'SELECT * FROM citizens WHERE age BETWEEN 25 AND 40;',
          hints: [
            'BETWEEN ... AND ... 包含两端值',
            'WHERE age BETWEEN 25 AND 40',
            'SELECT * FROM citizens WHERE age BETWEEN 25 AND 40;',
          ],
          successStory: 'Alice: "这就是城市的劳动力中坚分子。控制在这个区间能有效提升系统资源利用率。"',
        },
        {
          prompt: "📋 数据参考：表 citizens (id, name, age, district, job, salary)\n\n查询住在 '东区', '西区', '中心区' 的居民姓名和所在区",
          answerSql: "SELECT name, district FROM citizens WHERE district IN ('东区', '西区', '中心区');",
          hints: [
            'IN (...) 可以匹配列表中的任意值',
            "WHERE district IN ('东区', '西区', '中心区')",
            "SELECT name, district FROM citizens WHERE district IN ('东区', '西区', '中心区');",
          ],
          successStory: 'Alice: "你掌握了 IN 的枚举列表，非常高效。继续。"',
        },
      ],
    },
    {
      id: 'ch1-4',
      title: '高薪普查',
      description: 'Alice: "高层的资金流向总是向金字塔尖汇聚。现在提取出这个城市金字塔最顶端的少数节点，用 ORDER BY 降序结合 LIMIT 切断尾巴。"',
      initSql: CITIZENS_SIMPLE_SQL,
      defaultSql: 'SELECT * FROM citizens ORDER BY salary DESC LIMIT 10;',
      tasks: [
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district, job, salary)\n\n查询所有居民，按薪资从高到低排列，只取前 10 名',
          answerSql: 'SELECT * FROM citizens ORDER BY salary DESC LIMIT 10;',
          hints: [
            'ORDER BY salary DESC 表示按薪资降序',
            'LIMIT 10 只取前 10 条',
            'SELECT * FROM citizens ORDER BY salary DESC LIMIT 10;',
          ],
          successStory: 'Alice: "很好，前十名的名单已备份。资源总是向头部聚拢的，这是系统的法则。"',
        },
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district, job, salary)\n\n查询薪资最高的前 5 名居民的姓名和薪资（跳过第 1 名）',
          answerSql: 'SELECT name, salary FROM citizens ORDER BY salary DESC LIMIT 5 OFFSET 1;',
          hints: [
            'OFFSET 跳过指定行数',
            'LIMIT 5 OFFSET 1 = 取第 2~6 名',
            'SELECT name, salary FROM citizens ORDER BY salary DESC LIMIT 5 OFFSET 1;',
          ],
          successStory: 'Alice: "跳过了首富数据。第一名是特别加密权限的，通常我们不直接触碰。干得好。"',
        },
      ],
    },
    {
      id: 'ch1-5',
      title: '数据画像',
      description: 'Alice: "个体的轮廓毫无价值。我们需要各行政区宏观的聚合画像（GROUP BY）。记住，HAVING 是聚合后用来筛除废弃特征块的最终滤网。"',
      initSql: CITIZENS_SIMPLE_SQL,
      defaultSql: 'SELECT district, COUNT(*) as cnt FROM citizens GROUP BY district;',
      tasks: [
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district, job, salary)\n\n统计每个区的居民数量，按数量从多到少排列',
          answerSql: 'SELECT district, COUNT(*) as cnt FROM citizens GROUP BY district ORDER BY cnt DESC;',
          hints: [
            'COUNT(*) 统计行数，GROUP BY 按列分组',
            'ORDER BY cnt DESC 按数量降序',
            'SELECT district, COUNT(*) as cnt FROM citizens GROUP BY district ORDER BY cnt DESC;',
          ],
          successStory: 'Alice: "基础人口聚合图谱生成完毕。"',
        },
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district, job, salary)\n\n统计每个区的平均薪资（四舍五入取整），列名为 avg_salary',
          answerSql: 'SELECT district, ROUND(AVG(salary)) as avg_salary FROM citizens GROUP BY district;',
          hints: [
            'AVG() 计算平均值，ROUND() 四舍五入',
            '按 district 分组',
            'SELECT district, ROUND(AVG(salary)) as avg_salary FROM citizens GROUP BY district;',
          ],
          successStory: 'Alice: "聚合函数表现稳定，你的运算模块正在升温。"',
        },
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district, job, salary)\n\n找出平均薪资超过 15000 的区，显示区名和平均薪资',
          answerSql: 'SELECT district, AVG(salary) as avg_salary FROM citizens GROUP BY district HAVING AVG(salary) > 15000;',
          hints: [
            'HAVING 用于过滤分组后的结果',
            'WHERE 在分组前过滤，HAVING 在分组后过滤',
            'SELECT district, AVG(salary) as avg_salary FROM citizens GROUP BY district HAVING AVG(salary) > 15000;',
          ],
          successStory: 'Alice: "只有这几个区有优质资源。记住，HAVING 是聚合后的最终滤网。完毕。"',
        },
      ],
    },
    {
      id: 'ch1-6',
      title: '模糊追踪',
      description: 'Alice: "安全局刚刚截获到了不完整的字符碎片。利用模糊通配符（LIKE）把这些潜在危险分子全翻出来。"',
      initSql: CITIZENS_SIMPLE_SQL,
      defaultSql: "SELECT * FROM citizens WHERE name LIKE '张%';",
      tasks: [
        {
          prompt: "📋 数据参考：表 citizens (id, name, age, district, job, salary)\n\n查询 name 以 '张' 开头的所有居民",
          answerSql: "SELECT * FROM citizens WHERE name LIKE '张%';",
          hints: [
            "LIKE '张%' 匹配以张开头的字符串",
            "% 是通配符，匹配任意字符",
            "SELECT * FROM citizens WHERE name LIKE '张%';",
          ],
          successStory: 'Alice: "模糊特征匹配完成。你的模式识别能力已经过关。"',
        },
        {
          prompt: "📋 数据参考：表 citizens (id, name, age, district, job, salary)\n\n查询 job 包含 '工程' 二字的所有居民姓名和职位",
          answerSql: "SELECT name, job FROM citizens WHERE job LIKE '%工程%';",
          hints: [
            "LIKE '%工程%' 匹配包含'工程'的字符串",
            "前后都加 % 表示包含",
            "SELECT name, job FROM citizens WHERE job LIKE '%工程%';",
          ],
          successStory: 'Alice: "城市离不开这些建造者。干得很出色，第一网段诊断链路已全部联通。你是个优秀的探针。"',
        }
      ],
    },
  ],
}
