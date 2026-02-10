import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(request: Request) {
  const startTime = Date.now()
  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const dimension = searchParams.get('dimension')
  
  try {
    console.log('[API] Fetching analytics data from SALESCOMMISSION_Cache...')
    
    // Complete list of all employees with their names
    const allEmployees = [
      { code: 'Y130016', name: 'ธนวัฒน์ ภมะราภา' },
      { code: 'Y110003', name: 'ยุพิน ถิ่นวัฒนากูล' },
      { code: 'Y110109', name: 'กัญญา รอดภัย' },
      { code: 'Y110020', name: 'ปิยาภรณ์ แก้วลังกา' },
      { code: 'Y610678', name: 'กฤษดา ถังทอง' },
      { code: 'Y510172', name: 'อำนาจ ตะโส (เกี้ย)' },
      { code: 'Y610426', name: 'ชัยณรงค์ ปานเปีย' },
      { code: 'Y111196', name: 'ศุภัคษิ์ชยา พันธ์แจ่ม' },
      { code: 'Y111199', name: 'อภิญญา มาตทอง' },
      { code: 'Y111217', name: 'ปัญจรัตน์ ศิริกาญจนเศวต' },
      { code: 'Y111221', name: 'ฐิตาภากาญจน์ ภูหิรัญประเสริฐ' },
      { code: 'Y810487', name: 'กิตติศักดิ์ กล่ำเหว่า' },
      { code: 'Y110026', name: 'วุฒิพงศ์ เสริมสุข' },
      { code: 'Y510310', name: 'สรวิชญ์ ศรีสังวรณ์ (นกหวีด)' },
      { code: 'Y710008', name: 'ธีรนิติ์ พานแก้ว' }
    ]
    
    const allowedCodes = allEmployees.map(emp => emp.code)
    
    /*
      Logic สำหรับการคำนวณ QTY:
      
      1. TotalQTY = ยอดขายตาม INVOICEDATE (ใช้คำนวณอัตราเฉลี่ย)
      2. PaidQTY = ยอดที่ชำระแล้วตาม LASTSETTLEDATE (ใช้คำนวณ Commission)
      3. ICA/ISW (ใบลดหนี้) → QTY ลบ (หักออก)
    */
    
    // Build date filter conditions
    let invoiceDateFilter = ''
    let settleDateFilter = ''
    
    if (startDate && endDate) {
      invoiceDateFilter = `AND INVOICEDATE >= '${startDate}' AND INVOICEDATE <= '${endDate}'`
      settleDateFilter = `AND LASTSETTLEDATE >= '${startDate}' AND LASTSETTLEDATE <= '${endDate}'`
    } else if (year) {
      invoiceDateFilter = `AND YEAR(INVOICEDATE) = ${parseInt(year)}`
      settleDateFilter = `AND YEAR(LASTSETTLEDATE) = ${parseInt(year)}`
    }
    
    const dimensionFilter = dimension ? `AND BPC_DIMENSION5_ = '${dimension}'` : ''
    
    // Query for TotalQTY (INVOICEDATE) and PaidQTY (LASTSETTLEDATE)
    let queryString = `
      WITH InvoiceQTY AS (
        SELECT 
          BPC_DIMENSION5_,
          SUM(
            CASE 
              WHEN LASTSETTLEVOUCHER LIKE 'ICA%' OR LASTSETTLEVOUCHER LIKE 'ISW%'
                THEN -QTY
              ELSE QTY
            END
          ) as TotalQTY
        FROM SALESCOMMISSION_Cache
        WHERE INVOICEDATE IS NOT NULL 
          AND BPC_DIMENSION5_ IS NOT NULL 
          AND BPC_DIMENSION5_ != '' 
          AND QTY > 0
          AND (
            ${allowedCodes.map(code => `BPC_DIMENSION5_ LIKE '${code}%'`).join(' OR ')}
          )
          ${invoiceDateFilter}
          ${dimensionFilter}
        GROUP BY BPC_DIMENSION5_
      ),
      SettleQTY AS (
        SELECT 
          BPC_DIMENSION5_,
          SUM(
            CASE 
              WHEN LASTSETTLEVOUCHER LIKE 'ICA%' OR LASTSETTLEVOUCHER LIKE 'ISW%'
                THEN -QTY
              ELSE QTY
            END
          ) as PaidQTY
        FROM SALESCOMMISSION_Cache
        WHERE LASTSETTLEDATE IS NOT NULL 
          AND BPC_DIMENSION5_ IS NOT NULL 
          AND BPC_DIMENSION5_ != '' 
          AND QTY > 0
          AND (
            ${allowedCodes.map(code => `BPC_DIMENSION5_ LIKE '${code}%'`).join(' OR ')}
          )
          ${settleDateFilter}
          ${dimensionFilter}
        GROUP BY BPC_DIMENSION5_
      )
      SELECT 
        COALESCE(i.BPC_DIMENSION5_, s.BPC_DIMENSION5_) as BPC_DIMENSION5_,
        ISNULL(i.TotalQTY, 0) as TotalQTY,
        ISNULL(s.PaidQTY, 0) as PaidQTY
      FROM InvoiceQTY i
      FULL OUTER JOIN SettleQTY s ON i.BPC_DIMENSION5_ = s.BPC_DIMENSION5_
      ORDER BY BPC_DIMENSION5_
    `
    
    const dbData = await query(queryString)
    
    // Create a map of database results
    const dbMap = new Map()
    dbData.forEach((row: any) => {
      const code = row.BPC_DIMENSION5_.split(',')[0]
      dbMap.set(code, {
        TotalQTY: row.TotalQTY || 0,
        PaidQTY: row.PaidQTY || 0
      })
    })
    
    // Merge with all employees list
    const data = allEmployees.map(emp => {
      const qtyData = dbMap.get(emp.code) || { TotalQTY: 0, PaidQTY: 0 }
      return {
        EmployeeCode: emp.code,
        EmployeeName: emp.name,
        BPC_DIMENSION5_: `${emp.code},${emp.name}`,
        TotalQTY: qtyData.TotalQTY,
        PaidQTY: qtyData.PaidQTY
      }
    })
    
    const duration = Date.now() - startTime
    
    console.log(`[API] Analytics query completed in ${duration}ms, rows: ${data.length}`)
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error(`[API] Failed to fetch analytics after ${duration}ms:`, error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch analytics data',
        message: error.message || 'Database connection error',
        duration: duration
      },
      { status: 500 }
    )
  }
}
