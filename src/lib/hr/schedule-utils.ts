import { db } from '@/lib/database'

export interface EmployeeSchedule {
  isWorkDay: boolean
  startTime: string | null
  endTime: string | null
  breakMinutes: number
  source: 'rotating' | 'fixed' | null
  shiftType?: string
  patternId?: number
  patternName?: string
}

/**
 * Get the schedule for an employee on a specific date
 * Priority:
 * 1. Check market_employee_shifts for rotating/specific shifts
 * 2. Fallback to market_schedule_days (fixed weekly schedule)
 */
export async function getEmployeeScheduleForDate(
  employeeId: number,
  date: Date
): Promise<EmployeeSchedule | null> {
  const dateStr = date.toISOString().split('T')[0]

  // 1. First check for rotating/specific shift
  const shiftResult = await db.query(`
    SELECT
      es.shifttype,
      es.starttime,
      es.endtime,
      es.breakminutes,
      es.patternid,
      sp.name as patternname
    FROM market_employee_shifts es
    LEFT JOIN market_shift_patterns sp ON sp.id = es.patternid
    WHERE es.employeeid = $1 AND es.shiftdate = $2
  `, [employeeId, dateStr])

  if (shiftResult.rows.length > 0) {
    const shift = shiftResult.rows[0]
    return {
      isWorkDay: shift.shifttype === 'work',
      startTime: shift.starttime,
      endTime: shift.endtime,
      breakMinutes: shift.breakminutes || 0,
      source: 'rotating',
      shiftType: shift.shifttype,
      patternId: shift.patternid,
      patternName: shift.patternname
    }
  }

  // 2. Fallback to fixed weekly schedule
  const contractResult = await db.query(`
    SELECT c.scheduleid FROM market_contracts c
    WHERE c.employeeid = $1 AND c.status = 'active'
    LIMIT 1
  `, [employeeId])

  if (contractResult.rows.length > 0 && contractResult.rows[0].scheduleid) {
    const dayOfWeek = date.getDay()
    const scheduleDayResult = await db.query(`
      SELECT isworkday, starttime, endtime, breakminutes
      FROM market_schedule_days
      WHERE scheduleid = $1 AND dayofweek = $2
    `, [contractResult.rows[0].scheduleid, dayOfWeek])

    if (scheduleDayResult.rows.length > 0) {
      const day = scheduleDayResult.rows[0]
      return {
        isWorkDay: day.isworkday,
        startTime: day.starttime,
        endTime: day.endtime,
        breakMinutes: day.breakminutes || 0,
        source: 'fixed'
      }
    }
  }

  return null
}

/**
 * Generate shifts for an employee based on a pattern
 */
export interface GenerateShiftsParams {
  employeeId: number
  companyId: number
  patternId: number
  startDate: Date
  endDate: Date
  firstWorkDay: Date
  createdBy?: number
}

export interface ShiftPattern {
  id: number
  workdays: number
  restdays: number
  starttime: string
  endtime: string
  breakminutes: number
  name: string
}

export interface GeneratedShift {
  employeeId: number
  companyId: number
  shiftDate: string
  patternId: number
  startTime: string | null
  endTime: string | null
  breakMinutes: number
  shiftType: 'work' | 'rest'
  createdBy?: number
}

export function generateShiftsFromPattern(
  params: GenerateShiftsParams,
  pattern: ShiftPattern
): GeneratedShift[] {
  const { employeeId, companyId, patternId, startDate, endDate, firstWorkDay, createdBy } = params
  const shifts: GeneratedShift[] = []
  const cycleLength = pattern.workdays + pattern.restdays

  let currentDate = new Date(startDate)
  currentDate.setHours(0, 0, 0, 0)

  const firstWork = new Date(firstWorkDay)
  firstWork.setHours(0, 0, 0, 0)

  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)

  // Calculate offset from first work day
  const daysDiff = Math.floor(
    (currentDate.getTime() - firstWork.getTime()) / (1000 * 60 * 60 * 24)
  )
  let cyclePosition = ((daysDiff % cycleLength) + cycleLength) % cycleLength

  while (currentDate <= end) {
    const isWorkDay = cyclePosition < pattern.workdays

    shifts.push({
      employeeId,
      companyId,
      shiftDate: currentDate.toISOString().split('T')[0],
      patternId,
      shiftType: isWorkDay ? 'work' : 'rest',
      startTime: isWorkDay ? pattern.starttime : null,
      endTime: isWorkDay ? pattern.endtime : null,
      breakMinutes: isWorkDay ? pattern.breakminutes : 0,
      createdBy
    })

    currentDate.setDate(currentDate.getDate() + 1)
    cyclePosition = (cyclePosition + 1) % cycleLength
  }

  return shifts
}

/**
 * Calculate late minutes based on schedule
 */
export function calculateLateMinutes(
  checkInTime: Date,
  scheduledStartTime: string | null
): number {
  if (!scheduledStartTime) return 0

  const [scheduledHour, scheduledMinute] = scheduledStartTime.split(':').map(Number)
  const scheduledTime = new Date(checkInTime)
  scheduledTime.setHours(scheduledHour, scheduledMinute, 0, 0)

  if (checkInTime > scheduledTime) {
    return Math.round((checkInTime.getTime() - scheduledTime.getTime()) / (1000 * 60))
  }

  return 0
}

/**
 * Calculate early departure minutes based on schedule
 */
export function calculateEarlyDepartureMinutes(
  checkOutTime: Date,
  scheduledEndTime: string | null
): number {
  if (!scheduledEndTime) return 0

  const [scheduledHour, scheduledMinute] = scheduledEndTime.split(':').map(Number)
  const scheduledTime = new Date(checkOutTime)
  scheduledTime.setHours(scheduledHour, scheduledMinute, 0, 0)

  if (checkOutTime < scheduledTime) {
    return Math.round((scheduledTime.getTime() - checkOutTime.getTime()) / (1000 * 60))
  }

  return 0
}

/**
 * Calculate overtime hours based on schedule
 */
export function calculateOvertimeHours(
  checkOutTime: Date,
  scheduledEndTime: string | null
): number {
  if (!scheduledEndTime) return 0

  const [scheduledHour, scheduledMinute] = scheduledEndTime.split(':').map(Number)
  const scheduledTime = new Date(checkOutTime)
  scheduledTime.setHours(scheduledHour, scheduledMinute, 0, 0)

  if (checkOutTime > scheduledTime) {
    return (checkOutTime.getTime() - scheduledTime.getTime()) / (1000 * 60 * 60)
  }

  return 0
}
