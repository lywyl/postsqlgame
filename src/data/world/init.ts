import { DISTRICTS_SQL } from './districts'
import { CITIZENS_SIMPLE_SQL, CITIZENS_FULL_SQL } from './citizens'
import { EMPLOYEES_SQL } from './employees'
import { TRANSACTIONS_SQL } from './transactions'
import { BUILDINGS_SQL } from './buildings'
import { CRIME_RECORDS_SQL } from './crime-records'
import { SENSOR_DATA_SQL } from './sensor-data'
import { DOCUMENTS_SQL } from './documents'
import { AUDIT_LOG_SQL } from './audit-log'

export { DISTRICTS_SQL, CITIZENS_SIMPLE_SQL, CITIZENS_FULL_SQL, EMPLOYEES_SQL, TRANSACTIONS_SQL, BUILDINGS_SQL, CRIME_RECORDS_SQL, SENSOR_DATA_SQL, DOCUMENTS_SQL, AUDIT_LOG_SQL }

/** Ch1 用：districts + citizens(带 district TEXT) */
export const DISTRICTS_CITIZENS_SIMPLE_SQL = DISTRICTS_SQL + CITIZENS_SIMPLE_SQL

/** Ch2/Ch3 用：districts + citizens(带 district_id FK) */
export const DISTRICTS_CITIZENS_FULL_SQL = DISTRICTS_SQL + CITIZENS_FULL_SQL

/** 完整世界数据：所有核心表 */
export const FULL_WORLD_SQL = DISTRICTS_SQL + CITIZENS_FULL_SQL + EMPLOYEES_SQL + TRANSACTIONS_SQL

/** Ch5 DDL 用：完整世界数据 + buildings 表 */
export const FULL_WORLD_WITH_BUILDINGS_SQL = FULL_WORLD_SQL + BUILDINGS_SQL

/** Ch11+ 用：完整世界数据 + buildings + crime_records */
export const FULL_WORLD_WITH_CRIME_SQL = FULL_WORLD_WITH_BUILDINGS_SQL + CRIME_RECORDS_SQL

/** Ch14 用：完整世界 + documents */
export const FULL_WORLD_WITH_DOCUMENTS_SQL = FULL_WORLD_WITH_BUILDINGS_SQL + DOCUMENTS_SQL

/** 最全数据：所有表 */
export const FULL_WORLD_ALL_SQL = FULL_WORLD_WITH_BUILDINGS_SQL + CRIME_RECORDS_SQL + SENSOR_DATA_SQL + DOCUMENTS_SQL + AUDIT_LOG_SQL