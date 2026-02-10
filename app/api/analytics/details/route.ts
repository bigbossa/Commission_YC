import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(request: Request) {
  const startTime = Date.now()
  const { searchParams } = new URL(request.url)
  const employeeCode = searchParams.get('employeeCode')
  const year = searchParams.get('year')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const dimension = searchParams.get('dimension')
  
  if (!employeeCode) {
    return NextResponse.json(
      { error: 'Employee code is required' },
      { status: 400 }
    )
  }
  
  try {
    console.log(`[API] Fetching analytics details for employee ${employeeCode}...`)
    
    /*
      Logic สำหรับการคำนวณ QTY:
      - ใช้ INVOICEDATE สำหรับ filter วันที่
      - ICA/ISW (ใบลดหนี้) = QTY ติดลบ (หักออก)
      - อื่นๆ = QTY บวก
    */
    
    // Simple query using INVOICEDATE
    let queryString = `
      SELECT 
        SALESID,
        INVOICEID,
        LASTSETTLEVOUCHER,
        RECID,
        BPC_DIMENSION5_,
        -- QTY: ใบลดหนี้ = ลบ, อื่นๆ = บวก
        CASE 
          WHEN LASTSETTLEVOUCHER LIKE 'ICA%' OR LASTSETTLEVOUCHER LIKE 'ISW%'
            THEN -QTY
          ELSE QTY
        END as QTY,
        CONVERT(VARCHAR, INVOICEDATE, 23) as InvoiceDate,
        CONVERT(VARCHAR, LASTSETTLEDATE, 23) as LastSettleDate,
        -- กำหนด Voucher Type
        CASE 
          WHEN LASTSETTLEVOUCHER LIKE 'CA%' THEN 'CA'
          WHEN LASTSETTLEVOUCHER LIKE 'RV%' THEN 'RV'
          WHEN LASTSETTLEVOUCHER LIKE 'PDC%' THEN 'PDC'
          WHEN LASTSETTLEVOUCHER LIKE 'ICA%' THEN 'ICA'
          WHEN LASTSETTLEVOUCHER LIKE 'ISW%' THEN 'ISW'
          ELSE 'OTHER'
        END as VoucherType
      FROM SALESCOMMISSION_Cache
      WHERE INVOICEDATE IS NOT NULL 
        AND BPC_DIMENSION5_ LIKE '${employeeCode}%'
        AND QTY > 0
    `
    
    // Filter ตามช่วงวันที่โดยใช้ INVOICEDATE
    if (startDate && endDate) {
      queryString += ` AND INVOICEDATE >= '${startDate}' AND INVOICEDATE <= '${endDate}'`
    } else if (year) {
      queryString += ` AND YEAR(INVOICEDATE) = ${parseInt(year)}`
    }
    
    if (dimension) {
      queryString += ` AND BPC_DIMENSION5_ = '${dimension}'`
    }
    
    queryString += ` ORDER BY INVOICEDATE DESC, ABS(QTY) DESC`
    
    console.log('[API] Executing query:', queryString)
    
    const dbData = await query(queryString)
    
    // Transform data to match frontend expectations
    const data = dbData.map((row: any, index: number) => ({
      ItemNo: `${index + 1}`,
      SalesId: row.SALESID || '-',
      InvoiceId: row.INVOICEID || '-',
      LastSettleVoucher: row.LASTSETTLEVOUCHER || '-',
      RecId: row.RECID || '-',
      Description: row.BPC_DIMENSION5_ || '-',
      TotalQTY: row.QTY || 0,
      InvoiceDate: row.InvoiceDate || null,
      LastSettleDate: row.LastSettleDate || null,
      VoucherType: row.VoucherType || '-'
    }))
    
    const duration = Date.now() - startTime
    
    console.log(`[API] Analytics details query completed in ${duration}ms, rows: ${data.length}`)
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error(`[API] Failed to fetch analytics details after ${duration}ms:`, error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch analytics details',
        message: error.message || 'Database connection error',
        duration: duration
      },
      { status: 500 }
    )
  }
}
