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
    
    // Query to get detailed breakdown with sales info
    let queryString = `
      SELECT TOP 500
        SALESID,
        INVOICEID,
        LASTSETTLEVOUCHER,
        RECID,
        BPC_DIMENSION5_,
        QTY,
        CONVERT(VARCHAR, LASTSETTLEDATE, 23) as SettleDate
      FROM SALESCOMMISSION_Cache
      WHERE LASTSETTLEDATE IS NOT NULL 
        AND BPC_DIMENSION5_ LIKE '${employeeCode}%'
        AND QTY > 0
    `
    
    if (startDate && endDate) {
      queryString += ` AND LASTSETTLEDATE >= '${startDate}' AND LASTSETTLEDATE <= '${endDate}'`
    } else if (year) {
      queryString += ` AND YEAR(LASTSETTLEDATE) = ${parseInt(year)}`
    }
    
    if (dimension) {
      queryString += ` AND BPC_DIMENSION5_ = '${dimension}'`
    }
    
    queryString += ` ORDER BY LASTSETTLEDATE DESC, QTY DESC`
    
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
      LastSettleDate: row.SettleDate || null
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
