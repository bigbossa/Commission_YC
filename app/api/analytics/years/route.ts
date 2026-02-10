import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET() {
  const startTime = Date.now()
  
  try {
    console.log('[API] Fetching available years from SALESCOMMISSION_Cache...')
    
    const queryString = `
      SELECT DISTINCT YEAR(INVOICEDATE) as Year
      FROM SALESCOMMISSION_Cache
      WHERE INVOICEDATE IS NOT NULL
      ORDER BY YEAR(INVOICEDATE) DESC
    `
    
    const data = await query(queryString)
    const duration = Date.now() - startTime
    
    console.log(`[API] Years query completed in ${duration}ms, rows: ${data.length}`)
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error(`[API] Failed to fetch years after ${duration}ms:`, error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch years data',
        message: error.message || 'Database connection error',
        duration: duration
      },
      { status: 500 }
    )
  }
}
