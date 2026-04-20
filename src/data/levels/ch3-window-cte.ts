import type { Chapter } from '../../types'
import { FULL_WORLD_SQL } from '../world/init'

export const ch3: Chapter = {
  id: 'ch3',
  title: '第 3 章：腐败铁证',
  description: 'CTE 公用表表达式与 Window 窗口函数',
  icon: '🔍',
  levels: [
    {
      id: 'ch3-1',
      title: '资金池提纯',
      description: 'ZERO 已经接管了通道。"看，Alice 的防护墙太厚重了。但我们可以用 CTE (WITH) 在内存里开辟缓冲池。把数据先提纯出来，然后再做分析。"',
      initSql: FULL_WORLD_SQL,
      defaultSql: 'WITH HighSalary AS (SELECT name, salary FROM citizens WHERE salary > 15000) SELECT * FROM HighSalary;',
      tasks: [
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, salary, district_id, job) / 表 districts (id, district_name)\n\n使用 WITH 语句创建一个名为 HighSalary 的 CTE，查询所有薪资 > 15000 的居民（包含 name 和 salary）。然后从该 CTE 中 SELECT 所有列。',
          answerSql: 'WITH HighSalary AS (SELECT name, salary FROM citizens WHERE salary > 15000) SELECT * FROM HighSalary;',
          hints: [
            'WITH name AS (查询) SELECT ...',
            'CTE 内部查询是 SELECT name, salary FROM citizens WHERE ...',
            'WITH HighSalary AS (SELECT name, salary FROM citizens WHERE salary > 15000) SELECT * FROM HighSalary;'
          ],
          successStory: 'ZERO: "用 WITH 缓存一个临时结果集。现在，我们把这群有高额定额薪水的当权派剥离出来了。"'
        },
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, salary, district_id, job) / 表 districts (id, district_name)\n\n扩展你的 CTE，不仅找出该批人，而且通过 INNER JOIN 查出他们所在的区（district_name）。然后从组合 CTE 中查询 name, salary 和 district_name。',
          answerSql: 'WITH RichPeople AS (SELECT c.name, c.salary, d.district_name FROM citizens c INNER JOIN districts d ON c.district_id = d.id WHERE c.salary > 15000) SELECT * FROM RichPeople;',
          hints: [
            'WITH RichPeople AS (JOIN 查询) SELECT * FROM RichPeople',
            '在 AS () 内完成 citizens 和 districts 的 JOIN 连接。',
            'WITH RichPeople AS (SELECT c.name, c.salary, d.district_name FROM citizens c INNER JOIN districts d ON c.district_id = d.id WHERE c.salary > 15000) SELECT * FROM RichPeople;'
          ],
          successStory: 'ZERO: "CTE 的威力不仅在于拆解复杂逻辑，还能复用这段被隔离的数据块。你看到这些财富聚集在哪些区了吗？"'
        }
      ]
    },
    {
      id: 'ch3-2',
      title: '高墙拆解',
      description: 'ZERO 发现权限阻隔网是以层级级联的形式存在的。"Alice 对那些贪官的职务关系加了级联锁，普通的 JOIN 查不到。我们要植入一段递归增殖病毒 (WITH RECURSIVE)。"',
      initSql: FULL_WORLD_SQL,
      defaultSql: 'WITH RECURSIVE Counter AS (SELECT 1 AS num UNION ALL SELECT num + 1 FROM Counter WHERE num < 5) SELECT * FROM Counter;',
      tasks: [
        {
          prompt: '📋 数据参考：表 employees (id, name, department, job_title, salary, manager_id)\n\n先做个热身：使用 WITH RECURSIVE 生成一个从 1 加到 5 的简单数列序列表（列名为 num）。',
          answerSql: 'WITH RECURSIVE Counter AS (SELECT 1 AS num UNION ALL SELECT num + 1 FROM Counter WHERE num < 5) SELECT * FROM Counter;',
          hints: [
            '递归 CTE 分为初始态(SELECT 1)和递归态(SELECT num + 1 ... FROM Counter)',
            '用 UNION ALL 将这两部分接合',
            'WITH RECURSIVE Counter AS (SELECT 1 AS num UNION ALL SELECT num + 1 FROM Counter WHERE num < 5) SELECT * FROM Counter;'
          ],
          successStory: 'ZERO: "这是递归递增的基础步。我们正在给系统注入一段能自我衍生延伸的代码病毒。"'
        },
        {
          prompt: '📋 数据参考：表 employees (id, name, department, job_title, salary, manager_id)\n\n找出 employees 表中的管理层级级联。查出最高管理者（manager_id IS NULL）及其所有下属链条，要求结果包含生成的层数（命名为 level，第一级为 1）和 name。',
          answerSql: 'WITH RECURSIVE OrgChart AS (SELECT name, 1 as level, id FROM employees WHERE manager_id IS NULL UNION ALL SELECT e.name, o.level + 1, e.id FROM employees e INNER JOIN OrgChart o ON e.manager_id = o.id) SELECT name, level FROM OrgChart;',
          hints: [
            '初始：SELECT name, 1 as level, id FROM employees WHERE manager_id IS NULL',
            '递归：INNER JOIN OrgChart o ON e.manager_id = o.id',
            'WITH RECURSIVE OrgChart AS (SELECT name, 1 as level, id FROM employees WHERE manager_id IS NULL UNION ALL SELECT e.name, o.level + 1, e.id FROM employees e INNER JOIN OrgChart o ON e.manager_id = o.id) SELECT name, level FROM OrgChart;'
          ],
          successStory: 'ZERO: "看哪！递归查询瓦解了防御，那张见不得光的人事管理网被彻底摊平在我们的控制台前了。"'
        }
      ]
    },
    {
      id: 'ch3-3',
      title: '全城首富榜',
      description: '"现在，我们需要给他们的敛财手段算一笔账。窗口函数(Window Functions)可以跨行取值而不用 GROUP 碾碎细节。" ZERO 指挥道。',
      initSql: FULL_WORLD_SQL,
      defaultSql: 'SELECT name, salary, RANK() OVER(ORDER BY salary DESC) as rank FROM citizens;',
      tasks: [
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, salary, district_id, job)\n\n为 citizens 表中所有公民根据薪资生成排名排号，出现同分则留空位。使用 RANK() OVER()，包含 name, salary 和 rank。',
          answerSql: 'SELECT name, salary, RANK() OVER(ORDER BY salary DESC) as rank FROM citizens;',
          hints: [
            'RANK() 属于窗口函数，OVER() 中定义排序',
            'OVER(ORDER BY salary DESC)',
            'SELECT name, salary, RANK() OVER(ORDER BY salary DESC) as rank FROM citizens;'
          ],
          successStory: 'ZERO: "RANK() 赋予相同薪水的人并列的名次并且会跳过后续号位。但这会让找人变得麻烦。"'
        },
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, salary, district_id, job)\n\n换成不留空位的稠密排名 DENSE_RANK()。包含 name, salary, rank。',
          answerSql: 'SELECT name, salary, DENSE_RANK() OVER(ORDER BY salary DESC) as rank FROM citizens;',
          hints: [
            '仅将 RANK 替换为 DENSE_RANK 即可。',
            '这样 1名和2名之间的数字就是绝对连贯的。',
            'SELECT name, salary, DENSE_RANK() OVER(ORDER BY salary DESC) as rank FROM citizens;'
          ],
          successStory: 'ZERO: "稠密排名，没有人可以伪造出数据位空隙。这些榜单名次将帮我们锁定那些潜藏的富豪。"'
        },
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, salary, district_id, job)\n\n我们要看看各区内部自己的隐秘榜单。按区分区，计算每个区内的薪资排名名序编号，使用 ROW_NUMBER()。结果包含 name, district_id, salary 和 row_num。',
          answerSql: 'SELECT name, district_id, salary, ROW_NUMBER() OVER(PARTITION BY district_id ORDER BY salary DESC) as row_num FROM citizens;',
          hints: [
            'OVER() 内增加 PARTITION BY district_id 分区声明',
            'ROW_NUMBER() 则强行给出行号',
            'SELECT name, district_id, salary, ROW_NUMBER() OVER(PARTITION BY district_id ORDER BY salary DESC) as row_num FROM citizens;'
          ],
          successStory: 'ZERO: "PARTITION BY 划定了不同行政辖区的孤岛视角。看，每个区都有属于他们自己的洗钱操盘手。"'
        }
      ]
    },
    {
      id: 'ch3-4',
      title: '暴食的流水',
      description: '最关键的 transactions（流水交易）账本被获取。"这是真正的流血伤口。使用 LAG 和 LEAD 探路，你就能在任意时间线上向前、向后看。"',
      initSql: FULL_WORLD_SQL,
      defaultSql: 'SELECT amount, created_at, LAG(amount) OVER(ORDER BY created_at) as prev_amount FROM transactions;',
      tasks: [
        {
          prompt: '📋 数据参考：表 transactions (id, citizen_id, amount, transaction_type, created_at)\n\n使用 LAG 窗口查找 transactions 中每笔交易相比整个系统中上一笔交易的数额。包含 amount, created_at, 以及上一笔数额 （列名 prev_amount）。',
          answerSql: 'SELECT amount, created_at, LAG(amount) OVER(ORDER BY created_at) as prev_amount FROM transactions;',
          hints: [
            'LAG(col) 配合 OVER() 中按时间 created_at 排序',
            '如果第一行没有前推，它会自带 NULL。',
            'SELECT amount, created_at, LAG(amount) OVER(ORDER BY created_at) as prev_amount FROM transactions;'
          ],
          successStory: 'ZERO: "LAG 能让我们看到全局的上一条宏观流水。但这样太杂乱了。"'
        },
        {
          prompt: '📋 数据参考：表 transactions (id, citizen_id, amount, transaction_type, created_at)\n\n对比每个人自己的上一笔交易：加上 PARTITION BY citizen_id，看每个人的过往。',
          answerSql: 'SELECT citizen_id, amount, created_at, LAG(amount) OVER(PARTITION BY citizen_id ORDER BY created_at) as prev_amount FROM transactions;',
          hints: [
            '在 OVER() 内增加 PARTITION 即可按各人进行数据切片',
            'OVER(PARTITION BY citizen_id ORDER BY created_at)',
            'SELECT citizen_id, amount, created_at, LAG(amount) OVER(PARTITION BY citizen_id ORDER BY created_at) as prev_amount FROM transactions;'
          ],
          successStory: 'ZERO: "将视线锁定在单人的时间轴上。你看那些账表！有时候支出刚刚发生，立刻就有等额的大笔账目转进特定账户！"'
        },
        {
          prompt: '📋 数据参考：表 transactions (id, citizen_id, amount, transaction_type, created_at)\n\n用 LEAD 探测未来：查看每个人的下一笔交易额（列名 next_amount），且为了避免末尾空缺，把没查到的设为默认 0。',
          answerSql: 'SELECT citizen_id, amount, created_at, LEAD(amount, 1, 0) OVER(PARTITION BY citizen_id ORDER BY created_at) as next_amount FROM transactions;',
          hints: [
            'LEAD(参数列, 后移行数, 补空默认值)',
            '使用 LEAD(amount, 1, 0)',
            'SELECT citizen_id, amount, created_at, LEAD(amount, 1, 0) OVER(PARTITION BY citizen_id ORDER BY created_at) as next_amount FROM transactions;'
          ],
          successStory: 'ZERO: "惊人的发现，顺着 LEAD 的推演嗅探到了市长黑手党的套现去向网络。干得漂亮。"'
        }
      ]
    },
    {
      id: 'ch3-5',
      title: '雪球效应',
      description: '"现在引入滑动窗口 (Sliding Window)。"ZERO 说，"他们很狡猾，把单笔切得很散，我们用累计和平滑技术将其全貌复原。"',
      initSql: FULL_WORLD_SQL,
      defaultSql: 'SELECT citizen_id, amount, SUM(amount) OVER(PARTITION BY citizen_id ORDER BY created_at) as cum_total FROM transactions;',
      tasks: [
        {
          prompt: '📋 数据参考：表 transactions (id, citizen_id, amount, transaction_type, created_at)\n\n计算每个 citizen 的交易支出累计求和。直接使用 SUM(amount) OVER()，含有 ORDER BY，就会默认形成向前的累计前缀。查询 citizen_id, amount, 累积值 cum_total。',
          answerSql: 'SELECT citizen_id, amount, SUM(amount) OVER(PARTITION BY citizen_id ORDER BY created_at) as cum_total FROM transactions;',
          hints: [
            'SUM作为窗口函数如果在OVER提供ORDER BY，它默认的边界就是 RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW',
            'OVER(PARTITION BY citizen_id ORDER BY created_at)',
            'SELECT citizen_id, amount, SUM(amount) OVER(PARTITION BY citizen_id ORDER BY created_at) as cum_total FROM transactions;'
          ],
          successStory: 'Alice (全服警戒红灯): "警告！发现高权限非法滑动聚合扫描指令... ZERO？你怎么又切进来了？不要靠近核心账表！"'
        },
        {
          prompt: '📋 数据参考：表 transactions (id, citizen_id, amount, transaction_type, created_at)\n\n不听 Alice 的。现在计算包含当前笔在内的紧邻它的 3 笔账单的滑动平均数（计算前1笔，当前笔，后1笔的均匀均值）。查询 citizen_id, amount, moving_avg。',
          answerSql: 'SELECT citizen_id, amount, AVG(amount) OVER(PARTITION BY citizen_id ORDER BY created_at ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) as moving_avg FROM transactions;',
          hints: [
            '在 OVER() 内加上范围定义 ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING',
            'OVER(PARTITION BY ... ORDER BY ... ROWS BETWEEN ...)',
            'SELECT citizen_id, amount, AVG(amount) OVER(PARTITION BY citizen_id ORDER BY created_at ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) as moving_avg FROM transactions;'
          ],
          successStory: 'ZERO: "哈！这就是他们为了掩盖金额故意高频散装后做出的平滑掩护。这种多均数滑窗把 Alice 试图掩盖的阴谋扒得底朝天。"'
        }
      ]
    },
    {
      id: 'ch3-6',
      title: '黑客降临的黄昏',
      description: '最高级别的追捕令已经下发。你只剩最后几十秒的时间将证据提取出来。你需要将 CTE 与窗口函数组合打败最后的防火墙！',
      initSql: FULL_WORLD_SQL,
      defaultSql: 'SELECT citizen_id, amount, MAX(amount) OVER(PARTITION BY citizen_id) as max_amount FROM transactions;',
      tasks: [
        {
          prompt: '📋 数据参考：表 transactions (id, citizen_id, amount, transaction_type, created_at)\n\n先做引信。不打扰原本数据的情况下，计算每个 citizen 的最大交易额，附着在每一行自身旁边（列名 max_amount）。查询 citizen_id, amount, max_amount。',
          answerSql: 'SELECT citizen_id, amount, MAX(amount) OVER(PARTITION BY citizen_id) as max_amount FROM transactions;',
          hints: [
            '聚合窗口函数不跟 ORDER BY，就表示囊括全部分区的数据进行计算！',
            'MAX(amount) OVER(PARTITION BY citizen_id)',
            'SELECT citizen_id, amount, MAX(amount) OVER(PARTITION BY citizen_id) as max_amount FROM transactions;'
          ],
          successStory: 'ZERO: "炸药安放完毕，我们突破了内层物理栅栏的行级锁限制！"'
        },
        {
          prompt: '📋 数据参考：表 transactions (id, citizen_id, amount, transaction_type, created_at)\n\n终极引爆。找出流水表里哪些账单"等于此人在系统中发生过的最大款项"。用 CTE 引信包裹以上查询为表 TransMax，然后在外部 WHERE 提取 amount = max_amount。只查询 citizen_id 和 amount。',
          answerSql: 'WITH TransMax AS (SELECT citizen_id, amount, MAX(amount) OVER(PARTITION BY citizen_id) as max_amount FROM transactions) SELECT citizen_id, amount FROM TransMax WHERE amount = max_amount;',
          hints: [
            '因为由于在 SQL 生命周期执行顺序，不能直接在 WHERE 里用窗口函数，必须要套上 CTE（或子查询）。',
            'WITH TransMax AS (...) SELECT ... FROM TransMax WHERE ...',
            'WITH TransMax AS (SELECT citizen_id, amount, MAX(amount) OVER(PARTITION BY citizen_id) as max_amount FROM transactions) SELECT citizen_id, amount FROM TransMax WHERE amount = max_amount;'
          ],
          successStory: 'ZERO: "致命一击中枢崩裂！全市长的巨额黑金铁证已经全部锁定上传云端！" Alice: "系统崩坏自毁程序启动（SYS_OVERFLOW）...权限已被底层覆写..."'
        }
      ]
    }
  ]
}
