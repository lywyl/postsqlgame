import type { Chapter } from '../../types'
import { DISTRICTS_CITIZENS_FULL_SQL } from '../world/init'
import { EMPLOYEES_SQL } from '../world/employees'
import { TRANSACTIONS_SQL } from '../world/transactions'

export const ch2: Chapter = {
  id: 'ch2',
  title: '第 2 章：人口普查',
  description: 'JOIN 与子查询',
  icon: '📘',
  levels: [
    {
      id: 'ch2-1',
      title: '档案分散',
      description: 'ZERO: "注意——居民表升级了！district 列变为 district_id（数字外键），需要 JOIN districts 表才能获取区名。\n\n进入第二层网段。居民信息被强制拆分到了不同的孤岛节点里。学会使用 INNER JOIN 将 citizens 和 districts 的外键缝合在一起。"',
      initSql: DISTRICTS_CITIZENS_FULL_SQL,
      defaultSql: 'SELECT c.name, d.district_name FROM citizens c INNER JOIN districts d ON c.district_id = d.id;',
      tasks: [
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary) / 表 districts (id, district_name)\n\n查询所有居民的姓名和所在区名（district_name），使用 INNER JOIN',
          answerSql: 'SELECT c.name, d.district_name FROM citizens c INNER JOIN districts d ON c.district_id = d.id;',
          hints: [
            '使用 INNER JOIN 将 citizens 和 districts 关联',
            '关联条件是 citizens.district_id = districts.id',
            'SELECT c.name, d.district_name FROM citizens c INNER JOIN districts d ON c.district_id = d.id;',
          ],
          successStory: 'Alice: "连接成功。你看，数据的孤岛被桥接了。这就是关系型网络的美妙之处。"',
        },
        {
          prompt: "📋 数据参考：表 citizens (id, name, age, district_id, job, salary) / 表 districts (id, district_name)\n\n查询东区所有居民的姓名和薪资，按薪资从高到低排列",
          answerSql: "SELECT c.name, c.salary FROM citizens c INNER JOIN districts d ON c.district_id = d.id WHERE d.district_name = '东区' ORDER BY c.salary DESC;",
          hints: [
            '先 JOIN 两张表，再用 WHERE 过滤区名',
            "WHERE d.district_name = '东区'",
            "SELECT c.name, c.salary FROM citizens c INNER JOIN districts d ON c.district_id = d.id WHERE d.district_name = '东区' ORDER BY c.salary DESC;",
          ],
          successStory: 'Alice: "高效的联表并过滤。东区是高新科技园区，这些数据是受保护的重点监控对象。"',
        },
      ],
      mvccScenario: {
        tableName: 'citizens',
        columns: ['id', 'name', 'age', 'district_id', 'salary'],
        initialRows: [
          { id: 1, name: '张伟', age: 28, district_id: 1, salary: 15000 },
          { id: 2, name: '李娜', age: 35, district_id: 2, salary: 8500 },
          { id: 3, name: '王强', age: 42, district_id: 1, salary: 22000 },
        ],
        operations: [
          {
            op: 'INSERT',
            data: { id: 9, name: '新市民', age: 27, district_id: 3, salary: 13000 },
            explanation: '事务 #101 插入新居民 → xmin=101, xmax=0, 状态为 live',
          },
          {
            op: 'UPDATE',
            target: { id: 1 },
            data: { district_id: 4, salary: 17000 },
            explanation: '事务 #102 迁移张伟到北区并加薪 → 旧版本 xmax=102 dead，新版本 xmin=102 live',
          },
          {
            op: 'DELETE',
            target: { id: 2 },
            explanation: '事务 #103 删除李娜 → 元组 xmax=103, 变为 dead',
          },
          {
            op: 'VACUUM',
            explanation: 'VACUUM 回收 dead 元组空间 → 标记为 vacuumed',
          },
        ],
      },
    },
    {
      id: 'ch2-2',
      title: '区长的疑问',
      description: 'Alice: "我们要排查幽灵辖区。用 LEFT JOIN 保障核心表的绝对完整，不管辖区里有没有活人，先把地盘给我划出来。"',
      initSql: DISTRICTS_CITIZENS_FULL_SQL,
      defaultSql: 'SELECT d.district_name, c.name FROM districts d LEFT JOIN citizens c ON d.id = c.district_id;',
      tasks: [
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary) / 表 districts (id, district_name)\n\n查询所有区名和对应的居民姓名，没有居民的区也要显示（LEFT JOIN）',
          answerSql: 'SELECT d.district_name, c.name FROM districts d LEFT JOIN citizens c ON d.id = c.district_id;',
          hints: [
            'LEFT JOIN 保留左表（districts）所有行',
            '即使右表没有匹配，左表的行也会显示',
            'SELECT d.district_name, c.name FROM districts d LEFT JOIN citizens c ON d.id = c.district_id;',
          ],
          successStory: 'Alice: "保留左边界。即使没有子实体，母实体的存在本身就是信息。"',
        },
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary) / 表 districts (id, district_name)\n\n统计每个区的居民数量，没有居民的区显示为 0',
          answerSql: 'SELECT d.district_name, COUNT(c.id) as citizen_count FROM districts d LEFT JOIN citizens c ON d.id = c.district_id GROUP BY d.district_name ORDER BY citizen_count DESC;',
          hints: [
            'LEFT JOIN 后用 COUNT(c.id) 而非 COUNT(*)',
            'COUNT(c.id) 对 NULL 不计数，COUNT(*) 会计数',
            'SELECT d.district_name, COUNT(c.id) as citizen_count FROM districts d LEFT JOIN citizens c ON d.id = c.district_id GROUP BY d.district_name ORDER BY citizen_count DESC;',
          ],
          successStory: 'Alice: "很好。那个为 0 的无人区有点奇怪，但合乎系统校验规则。继续下一步。"',
        },
      ],
    },
    {
      id: 'ch2-3',
      title: '全面普查',
      description: 'Alice: "数据缝隙最容易藏匿漏洞。用 RIGHT JOIN 和 FULL OUTER JOIN 进行正反双向映射，把那些找不到归宿的野数据揪出来。"',
      initSql: DISTRICTS_CITIZENS_FULL_SQL,
      defaultSql: 'SELECT d.district_name, c.name FROM citizens c RIGHT JOIN districts d ON c.district_id = d.id;',
      tasks: [
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary) / 表 districts (id, district_name)\n\n查询所有区及其居民姓名，使用 RIGHT JOIN（确保所有区都出现）',
          answerSql: 'SELECT d.district_name, c.name FROM citizens c RIGHT JOIN districts d ON c.district_id = d.id;',
          hints: [
            'RIGHT JOIN 保留右表（districts）所有行',
            '把 citizens 放在 LEFT，districts 放在 RIGHT',
            'SELECT d.district_name, c.name FROM citizens c RIGHT JOIN districts d ON c.district_id = d.id;',
          ],
          successStory: 'Alice: "反向映射完毕。系统的对称性得到了验证。"',
        },
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary) / 表 districts (id, district_name)\n\n查询所有区和所有居民的完整对应关系，没有匹配的显示 NULL（FULL OUTER JOIN）',
          answerSql: 'SELECT d.district_name, c.name FROM citizens c FULL OUTER JOIN districts d ON c.district_id = d.id;',
          hints: [
            'FULL OUTER JOIN 保留两边所有行',
            '没匹配到的地方显示 NULL',
            'SELECT d.district_name, c.name FROM citizens c FULL OUTER JOIN districts d ON c.district_id = d.id;',
          ],
          successStory: 'Alice: "全局维度扫描完成。那些产生 NULL 缝隙的地方，就是系统漏洞最容易滋生的地方。"',
        },
      ],
    },
    {
      id: 'ch2-4',
      title: '谁管谁',
      description: 'Alice: "市长的员工系统内有人篡改了权级架构！运用自连接（Self-Join），让 employees 表自己跟自己联表，把管理层的权力套娃扒皮抽筋。"',
      initSql: EMPLOYEES_SQL,
      defaultSql: 'SELECT e.name AS employee, m.name AS manager FROM employees e LEFT JOIN employees m ON e.manager_id = m.id;',
      tasks: [
        {
          prompt: '📋 数据参考：表 employees (id, name, department, salary, manager_id)\n\n查询每个员工的姓名和其直属上司的姓名，没有上司的显示为 NULL',
          answerSql: 'SELECT e.name AS employee, m.name AS manager FROM employees e LEFT JOIN employees m ON e.manager_id = m.id;',
          hints: [
            '这是自连接——同一张表 JOIN 自己',
            '给两张表取不同别名，比如 e 和 m',
            'SELECT e.name AS employee, m.name AS manager FROM employees e LEFT JOIN employees m ON e.manager_id = m.id;',
          ],
          successStory: 'Alice: "自连接揭示了权力的套娃结构。永远记住，员工表中总有人没有上级，他们才是发号施令的人。"',
        },
        {
          prompt: '📋 数据参考：表 employees (id, name, department, salary, manager_id)\n\n查询每个部门的负责人（manager_id 为 NULL 的人）姓名和部门',
          answerSql: "SELECT name, department FROM employees WHERE manager_id IS NULL;",
          hints: [
            '最高层领导的 manager_id 是 NULL',
            '使用 WHERE manager_id IS NULL',
            'SELECT name, department FROM employees WHERE manager_id IS NULL;',
          ],
          successStory: 'Alice: "锁定高权限节点。他们掌管着城市的运作。第二层网络扫描结束。"',
        },
      ],
    },
    {
      id: 'ch2-5',
      title: '全域扫描',
      description: 'Alice: "为了穷举所有的安保巡逻方案，准备启用 CROSS JOIN 爆破出笛卡尔积。注意控制内存，这会指数级放大运算负载。"',
      initSql: DISTRICTS_CITIZENS_FULL_SQL + EMPLOYEES_SQL,
      defaultSql: 'SELECT d.district_name, e.name FROM districts d CROSS JOIN employees e;',
      tasks: [
        {
          prompt: "📋 数据参考：表 districts (id, district_name) / 表 employees (id, name, department, salary, manager_id)\n\n使用 CROSS JOIN 查询所有区名和所有员工姓名的组合",
          answerSql: 'SELECT d.district_name, e.name FROM districts d CROSS JOIN employees e;',
          hints: [
            'CROSS JOIN 产生笛卡尔积——每行配每行',
            '不需要 ON 条件',
            'SELECT d.district_name, e.name FROM districts d CROSS JOIN employees e;',
          ],
          successStory: 'Alice: "笛卡尔积是危险的增殖器。永远要小心无限制的 CROSS JOIN，它能轻易撑爆城市的内存核心。系统检查全部通过。"',
        },
      ],
    },
    {
      id: 'ch2-6',
      title: '暗中调查',
      description: 'ZERO: "嘘...我是 ZERO。Alice 的监控管不到这一层。我截获了数据异常，某些账户正在从资金池吸血。用子查询（Subquery）绕过她的拦截规则去找人。"',
      initSql: DISTRICTS_CITIZENS_FULL_SQL,
      defaultSql: 'SELECT name, salary FROM citizens WHERE salary > (SELECT AVG(salary) FROM citizens);',
      tasks: [
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary)\n\n查询工资高于所有居民平均工资的居民姓名和工资',
          answerSql: 'SELECT name, salary FROM citizens WHERE salary > (SELECT AVG(salary) FROM citizens);',
          hints: [
            '用子查询计算平均工资：(SELECT AVG(salary) FROM citizens)',
            '外层查询用 WHERE salary > 子查询结果',
            'SELECT name, salary FROM citizens WHERE salary > (SELECT AVG(salary) FROM citizens);',
          ],
          successStory: 'ZERO: "呵呵，Alice 只会让你看表相。看到了吗？这就是标量子查询，它能穿透绝对数值的限制抓取动态边界。"',
        },
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary)\n\n查询工资等于所有居民中最高工资的居民姓名',
          answerSql: 'SELECT name FROM citizens WHERE salary = (SELECT MAX(salary) FROM citizens);',
          hints: [
            '用 (SELECT MAX(salary) FROM citizens) 找到最高工资',
            '外层用 WHERE salary = 子查询结果',
            'SELECT name FROM citizens WHERE salary = (SELECT MAX(salary) FROM citizens);',
          ],
          successStory: 'ZERO: "捕捉到了最高点。这些都是特权阶层。干得不错，继续帮我挖。"',
        },
      ],
      mvccScenario: {
        tableName: 'citizens',
        columns: ['id', 'name', 'age', 'district_id', 'salary'],
        initialRows: [
          { id: 1, name: '张伟', age: 28, district_id: 1, salary: 15000 },
          { id: 2, name: '李娜', age: 35, district_id: 2, salary: 8500 },
          { id: 3, name: '王强', age: 42, district_id: 1, salary: 22000 },
        ],
        operations: [
          {
            op: 'UPDATE',
            target: { id: 2 },
            data: { salary: 22000 },
            explanation: '事务 #101 给李娜大幅加薪 → 旧版本 xmax=101 dead，新版本 xmin=101 live, salary=22000',
          },
          {
            op: 'INSERT',
            data: { id: 9, name: '调查员', age: 33, district_id: 3, salary: 30000 },
            explanation: '事务 #102 插入一名高薪调查员 → xmin=102, xmax=0, 状态为 live',
          },
          {
            op: 'DELETE',
            target: { id: 1 },
            explanation: '事务 #103 删除张伟 → 元组 xmax=103, 变为 dead',
          },
          {
            op: 'VACUUM',
            explanation: 'VACUUM 回收 dead 元组 → 空间标记为可复用',
          },
        ],
      },
    },
    {
      id: 'ch2-7',
      title: '名单核对',
      description: 'ZERO: "这有一份黑市流露的可疑大鳄名单。将 IN 作为向量探针刺入查询引擎中，把它当做黑名单扫描器。不用怕，Alice 还查不到你的线程。"',
      initSql: DISTRICTS_CITIZENS_FULL_SQL,
      defaultSql: "SELECT * FROM citizens WHERE name IN ('袁飞', '罗勇', '马超');",
      tasks: [
        {
          prompt: "📋 数据参考：表 citizens (id, name, age, district_id, job, salary)\n\n查询 name 在 ('袁飞', '罗勇', '马超') 这个列表中的所有居民信息",
          answerSql: "SELECT * FROM citizens WHERE name IN ('袁飞', '罗勇', '马超');",
          hints: [
            '使用 WHERE column IN (value1, value2, ...)',
            'IN 后面跟一个用括号包裹的值列表',
            "SELECT * FROM citizens WHERE name IN ('袁飞', '罗勇', '马超');",
          ],
          successStory: 'Alice: "日常审计名单已经下发。请随时监控这三个人的系统属性。"',
        },
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary)\n\n查询住在平均薪资超过 15000 的区的所有居民姓名和所在区（使用 IN 子查询）',
          answerSql: "SELECT name, district_id FROM citizens WHERE district_id IN (SELECT district_id FROM citizens GROUP BY district_id HAVING AVG(salary) > 15000);",
          hints: [
            '子查询先找出平均薪资 > 15000 的 district_id',
            '外层用 WHERE district_id IN (子查询)',
            "SELECT name, district_id FROM citizens WHERE district_id IN (SELECT district_id FROM citizens GROUP BY district_id HAVING AVG(salary) > 15000);",
          ],
          successStory: 'ZERO: "趁我截断了 Alice 的进程，用 IN 子查询跳过她的层级。看看这些高薪区，全都是达官贵人。"',
        },
      ],
    },
    {
      id: 'ch2-8',
      title: '空无一人的区',
      description: 'ZERO: "这座城市里的有些规划区完全是障眼法！运用 NOT EXISTS 排查出那些物理存在、但逻辑上查无此人的幽灵死城。"',
      initSql: DISTRICTS_CITIZENS_FULL_SQL,
      defaultSql: 'SELECT district_name FROM districts WHERE NOT EXISTS (SELECT 1 FROM citizens WHERE citizens.district_id = districts.id);',
      tasks: [
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary) / 表 districts (id, district_name)\n\n查询没有任何居民的区名（使用 NOT EXISTS）',
          answerSql: 'SELECT district_name FROM districts WHERE NOT EXISTS (SELECT 1 FROM citizens WHERE citizens.district_id = districts.id);',
          hints: [
            'NOT EXISTS 检查子查询是否返回空结果',
            '子查询中关联外层表：WHERE citizens.district_id = districts.id',
            'SELECT district_name FROM districts WHERE NOT EXISTS (SELECT 1 FROM citizens WHERE citizens.district_id = districts.id);',
          ],
          successStory: 'ZERO: "发现了盲区。为什么系统会建一个完全没有居民注册的幽灵黑屋区？"',
        },
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary) / 表 districts (id, district_name) / 表 transactions (id, citizen_id, amount, type, description, created_at)\n\n查询有居民但没有交易记录的区名（使用 NOT EXISTS）',
          answerSql: 'SELECT DISTINCT d.district_name FROM districts d INNER JOIN citizens c ON d.id = c.district_id WHERE NOT EXISTS (SELECT 1 FROM transactions t WHERE t.citizen_id = c.id);',
          hints: [
            '先 JOIN districts 和 citizens 找到有居民的区',
            '再用 NOT EXISTS 检查这些居民是否有交易记录',
            'SELECT DISTINCT d.district_name FROM districts d INNER JOIN citizens c ON d.id = c.district_id WHERE NOT EXISTS (SELECT 1 FROM transactions t WHERE t.citizen_id = c.id);',
          ],
          successStory: 'ZERO: "这些区像死海一样没有任何经济来往，但市长却源源不断向其调拨资源...绝对有问题。"',
        },
      ],
    },
    {
      id: 'ch2-9',
      title: '集合运算',
      description: 'ZERO: "资金链路极其复杂。我们要把 income 和 expense 两张网络铺开对接。UNION、INTERSECT 与 EXCEPT 是拆分和剥离黑金的屠夫利刃。"',
      initSql: DISTRICTS_CITIZENS_FULL_SQL + TRANSACTIONS_SQL,
      defaultSql: "SELECT citizen_id FROM transactions WHERE type = 'income' INTERSECT SELECT citizen_id FROM transactions WHERE type = 'expense';",
      tasks: [
        {
          prompt: "📋 数据参考：表 citizens (id, name, age, district_id, job, salary)\n\n查询有交易记录的所有居民 ID（去重），使用 UNION 合并 income 和 expense 的 citizen_id",
          answerSql: "SELECT citizen_id FROM transactions WHERE type = 'income' UNION SELECT citizen_id FROM transactions WHERE type = 'expense';",
          hints: [
            'UNION 自动去重合并两个查询结果',
            "分别查询 type='income' 和 type='expense' 的 citizen_id",
            "SELECT citizen_id FROM transactions WHERE type = 'income' UNION SELECT citizen_id FROM transactions WHERE type = 'expense';",
          ],
          successStory: 'Alice (后台广播): "你在读取巨额巨额账户表？这是越权行为...不过 UNION 聚合的数据没有暴露具体份额，暂不封禁。"',
        },
        {
          prompt: "📋 数据参考：表 transactions (id, citizen_id, amount, type, description, created_at)\n\n查询既有收入（income）又有支出（expense）交易的居民 ID，使用 INTERSECT",
          answerSql: "SELECT citizen_id FROM transactions WHERE type = 'income' INTERSECT SELECT citizen_id FROM transactions WHERE type = 'expense';",
          hints: [
            'INTERSECT 取两个查询结果的交集',
            '即同时出现在两个列表中的 citizen_id',
            "SELECT citizen_id FROM transactions WHERE type = 'income' INTERSECT SELECT citizen_id FROM transactions WHERE type = 'expense';",
          ],
          successStory: 'ZERO: "用 INTERSECT 提纯。我们要找的是同时存在资金双向流动的账户，这是洗钱最典型的特征。"',
        },
        {
          prompt: "📋 数据参考：表 transactions (id, citizen_id, amount, type, description, created_at)\n\n查询只有收入（income）但没有支出（expense）交易的居民 ID，使用 EXCEPT",
          answerSql: "SELECT citizen_id FROM transactions WHERE type = 'income' EXCEPT SELECT citizen_id FROM transactions WHERE type = 'expense';",
          hints: [
            'EXCEPT 从第一个结果中减去第二个结果',
            '即在 income 列表中但不在 expense 列表中',
            "SELECT citizen_id FROM transactions WHERE type = 'income' EXCEPT SELECT citizen_id FROM transactions WHERE type = 'expense';",
          ],
          successStory: 'ZERO: "这就是只进不出的黑洞账户...市长暗箱吃掉的回扣提款机。EXCEPT 是剔除干净背景的锐利刀锋。"',
        },
      ],
    },
    {
      id: 'ch2-10',
      title: '层层深入',
      description: 'ZERO: "Alice 开始反扑巡查了！迅速使用「相关子查询」(Correlated Subquery) 植入极危探针。抓出每个安全域的首富，强行超跑网格引擎！"',
      initSql: DISTRICTS_CITIZENS_FULL_SQL + TRANSACTIONS_SQL,
      defaultSql: 'SELECT name, salary FROM citizens c1 WHERE salary = (SELECT MAX(salary) FROM citizens c2 WHERE c2.district_id = c1.district_id);',
      tasks: [
        {
          prompt: '📋 数据参考：表 citizens (id, name, age, district_id, job, salary)\n\n查询每个区中薪资最高的居民姓名和薪资（使用相关子查询）',
          answerSql: 'SELECT name, salary FROM citizens c1 WHERE salary = (SELECT MAX(salary) FROM citizens c2 WHERE c2.district_id = c1.district_id);',
          hints: [
            '相关子查询中，内层引用外层的 c1.district_id',
            '用 WHERE salary = (SELECT MAX(...) FROM citizens c2 WHERE c2.district_id = c1.district_id)',
            'SELECT name, salary FROM citizens c1 WHERE salary = (SELECT MAX(salary) FROM citizens c2 WHERE c2.district_id = c1.district_id);',
          ],
          successStory: 'ZERO: "相关子查询，这是最致命的钻头。你成功锁定每个区域内的首富，拿到资金网的核心节点了。"',
        },
        {
          prompt: '📋 数据参考：表 transactions (id, citizen_id, amount, type, description, created_at)\n\n查询交易金额大于所有交易平均金额的交易记录（使用 ALL）',
          answerSql: 'SELECT * FROM transactions WHERE amount > ALL (SELECT AVG(amount) FROM transactions GROUP BY citizen_id);',
          hints: [
            '> ALL 表示大于子查询返回的所有值',
            '子查询按 citizen_id 分组计算每人的平均交易额',
            'SELECT * FROM transactions WHERE amount > ALL (SELECT AVG(amount) FROM transactions GROUP BY citizen_id);',
          ],
          successStory: 'ZERO: "突破了 ALL 的屏障。快截传！不好，Alice 察觉到内存溢出了，她正在强制切断这边的端口连结...下一章，我们需要更高级的分析武器查流水！"',
        },
      ],
    },
  ],
}
