import type { Chapter } from '../types'
import { ch1 } from './levels/ch1-select'
import { ch2 } from './levels/ch2-join-subquery'
import { ch3 } from './levels/ch3-window-cte'
import { ch4 } from './levels/ch4-ddl-constraints'
import { ch5 } from './levels/ch5-dml'
import { ch6 } from './levels/ch6-index-optimizer'
import { ch7 } from './levels/ch7-mvcc-wal'
import { ch8 } from './levels/ch8-security-functions'

export const chapters: Chapter[] = [
    ch1,
    ch2,
    ch3,
    ch4,
    ch5,
    ch6,
    ch7,
    ch8
]

// 备用章节（ch11~ch15）：内容已合并至 ch1~ch8，未启用。如需启用需重新编号章节 ID。
