import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(request: Request) {
  try {
    // 1. ดู Voucher Types ทั้งหมดใน SALESCOMMISSION_Cache
    const voucherTypes = await query(`
      SELECT 
        CASE 
          WHEN LASTSETTLEVOUCHER LIKE 'CA%' THEN 'CA'
          WHEN LASTSETTLEVOUCHER LIKE 'RV%' THEN 'RV'
          WHEN LASTSETTLEVOUCHER LIKE 'PDC%' THEN 'PDC'
          WHEN LASTSETTLEVOUCHER LIKE 'ICA%' THEN 'ICA'
          WHEN LASTSETTLEVOUCHER LIKE 'ISW%' THEN 'ISW'
          ELSE 'OTHER'
        END as VoucherType,
        COUNT(*) as RecordCount,
        SUM(QTY) as TotalQTY
      FROM SALESCOMMISSION_Cache
      WHERE LASTSETTLEDATE IS NOT NULL AND QTY > 0
      GROUP BY CASE 
          WHEN LASTSETTLEVOUCHER LIKE 'CA%' THEN 'CA'
          WHEN LASTSETTLEVOUCHER LIKE 'RV%' THEN 'RV'
          WHEN LASTSETTLEVOUCHER LIKE 'PDC%' THEN 'PDC'
          WHEN LASTSETTLEVOUCHER LIKE 'ICA%' THEN 'ICA'
          WHEN LASTSETTLEVOUCHER LIKE 'ISW%' THEN 'ISW'
          ELSE 'OTHER'
        END
      ORDER BY TotalQTY DESC
    `)

    // 2. ดู PDC ที่มี SQP และไม่มี SQP
    const pdcStatus = await query(`
      SELECT 
        CASE WHEN sqp.VOUCHER IS NOT NULL THEN 'PDC with SQP' ELSE 'PDC without SQP' END as Status,
        COUNT(*) as RecordCount,
        SUM(sc.QTY) as TotalQTY
      FROM SALESCOMMISSION_Cache sc
      LEFT JOIN CustSettle_Cache pdc 
        ON sc.LASTSETTLEVOUCHER = pdc.VOUCHER 
        AND pdc.VOUCHER LIKE 'PDC%'
      LEFT JOIN CustSettle_Cache rem 
        ON pdc.OFFSETTRANSVOUCHER = rem.VOUCHER 
        AND rem.VOUCHER LIKE 'REM%'
      LEFT JOIN CustSettle_Cache sqp 
        ON rem.OFFSETTRANSVOUCHER = sqp.VOUCHER 
        AND sqp.VOUCHER LIKE 'SQP%'
      WHERE sc.LASTSETTLEDATE IS NOT NULL 
        AND sc.QTY > 0
        AND sc.LASTSETTLEVOUCHER LIKE 'PDC%'
      GROUP BY CASE WHEN sqp.VOUCHER IS NOT NULL THEN 'PDC with SQP' ELSE 'PDC without SQP' END
    `)

    // 3. ดูตัวอย่าง PDC ที่ไม่มี SQP
    const pdcWithoutSQP = await query(`
      SELECT TOP 10
        sc.LASTSETTLEVOUCHER,
        pdc.VOUCHER as PDC_Found,
        pdc.OFFSETTRANSVOUCHER as PDC_Offset,
        rem.VOUCHER as REM_Found,
        rem.OFFSETTRANSVOUCHER as REM_Offset,
        sqp.VOUCHER as SQP_Found,
        sc.QTY
      FROM SALESCOMMISSION_Cache sc
      LEFT JOIN CustSettle_Cache pdc 
        ON sc.LASTSETTLEVOUCHER = pdc.VOUCHER 
        AND pdc.VOUCHER LIKE 'PDC%'
      LEFT JOIN CustSettle_Cache rem 
        ON pdc.OFFSETTRANSVOUCHER = rem.VOUCHER 
        AND rem.VOUCHER LIKE 'REM%'
      LEFT JOIN CustSettle_Cache sqp 
        ON rem.OFFSETTRANSVOUCHER = sqp.VOUCHER 
        AND sqp.VOUCHER LIKE 'SQP%'
      WHERE sc.LASTSETTLEDATE IS NOT NULL 
        AND sc.QTY > 0
        AND sc.LASTSETTLEVOUCHER LIKE 'PDC%'
        AND sqp.VOUCHER IS NULL
    `)

    // 4. ดูตัวอย่าง ICA/ISW
    const creditNotes = await query(`
      SELECT TOP 10
        sc.LASTSETTLEVOUCHER,
        SUBSTRING(sc.LASTSETTLEVOUCHER, 2, LEN(sc.LASTSETTLEVOUCHER)-1) as ExpectedVoucher,
        cn.VOUCHER as CN_Found,
        sc.QTY
      FROM SALESCOMMISSION_Cache sc
      LEFT JOIN CustSettle_Cache cn 
        ON cn.VOUCHER = CASE 
          WHEN sc.LASTSETTLEVOUCHER LIKE 'ICA%' OR sc.LASTSETTLEVOUCHER LIKE 'ISW%' 
          THEN SUBSTRING(sc.LASTSETTLEVOUCHER, 2, LEN(sc.LASTSETTLEVOUCHER)-1)
          ELSE NULL 
        END
      WHERE sc.LASTSETTLEDATE IS NOT NULL 
        AND sc.QTY > 0
        AND (sc.LASTSETTLEVOUCHER LIKE 'ICA%' OR sc.LASTSETTLEVOUCHER LIKE 'ISW%')
    `)

    // 5. สรุปผลที่ PASS logic ใหม่ vs เดิม
    const comparison = await query(`
      WITH OldLogic AS (
        SELECT SUM(QTY) as TotalQTY
        FROM SALESCOMMISSION_Cache
        WHERE LASTSETTLEDATE IS NOT NULL AND QTY > 0
      ),
      NewLogic AS (
        SELECT SUM(
          CASE 
            WHEN sc.LASTSETTLEVOUCHER LIKE 'ICA%' OR sc.LASTSETTLEVOUCHER LIKE 'ISW%'
              THEN -sc.QTY
            ELSE sc.QTY
          END
        ) as TotalQTY
        FROM SALESCOMMISSION_Cache sc
        LEFT JOIN CustSettle_Cache pdc 
          ON sc.LASTSETTLEVOUCHER = pdc.VOUCHER 
          AND pdc.VOUCHER LIKE 'PDC%'
        LEFT JOIN CustSettle_Cache rem 
          ON pdc.OFFSETTRANSVOUCHER = rem.VOUCHER 
          AND rem.VOUCHER LIKE 'REM%'
        LEFT JOIN CustSettle_Cache sqp 
          ON rem.OFFSETTRANSVOUCHER = sqp.VOUCHER 
          AND sqp.VOUCHER LIKE 'SQP%'
        LEFT JOIN CustSettle_Cache cn_voucher 
          ON cn_voucher.VOUCHER = CASE 
            WHEN sc.LASTSETTLEVOUCHER LIKE 'ICA%' OR sc.LASTSETTLEVOUCHER LIKE 'ISW%' 
            THEN SUBSTRING(sc.LASTSETTLEVOUCHER, 2, LEN(sc.LASTSETTLEVOUCHER)-1)
            ELSE NULL 
          END
        WHERE sc.LASTSETTLEDATE IS NOT NULL 
          AND sc.QTY > 0
          AND (
            -- เงินสด: CA/RV
            (sc.LASTSETTLEVOUCHER LIKE 'CA%' OR sc.LASTSETTLEVOUCHER LIKE 'RV%')
            -- เช็ค: PDC ที่มี SQP
            OR (sc.LASTSETTLEVOUCHER LIKE 'PDC%' AND sqp.TRANSDATE IS NOT NULL)
            -- ใบลดหนี้: ICA/ISW ที่มี voucher ตรงกัน
            OR ((sc.LASTSETTLEVOUCHER LIKE 'ICA%' OR sc.LASTSETTLEVOUCHER LIKE 'ISW%') AND cn_voucher.VOUCHER IS NOT NULL)
          )
      )
      SELECT 
        (SELECT TotalQTY FROM OldLogic) as OldLogic_TotalQTY,
        (SELECT TotalQTY FROM NewLogic) as NewLogic_TotalQTY
    `)

    // 6. ดู OTHER voucher types ที่ถูกตัดออก
    const otherVouchers = await query(`
      SELECT TOP 20
        LASTSETTLEVOUCHER,
        LEFT(LASTSETTLEVOUCHER, 4) as Prefix,
        QTY
      FROM SALESCOMMISSION_Cache
      WHERE LASTSETTLEDATE IS NOT NULL AND QTY > 0
        AND LASTSETTLEVOUCHER NOT LIKE 'CA%' 
        AND LASTSETTLEVOUCHER NOT LIKE 'RV%' 
        AND LASTSETTLEVOUCHER NOT LIKE 'PDC%' 
        AND LASTSETTLEVOUCHER NOT LIKE 'ICA%' 
        AND LASTSETTLEVOUCHER NOT LIKE 'ISW%'
      ORDER BY QTY DESC
    `)

    // 7. ดู Prefix ของ OTHER vouchers
    const otherPrefixes = await query(`
      SELECT 
        LEFT(LASTSETTLEVOUCHER, 3) as Prefix,
        COUNT(*) as RecordCount,
        SUM(QTY) as TotalQTY
      FROM SALESCOMMISSION_Cache
      WHERE LASTSETTLEDATE IS NOT NULL AND QTY > 0
        AND LASTSETTLEVOUCHER NOT LIKE 'CA%' 
        AND LASTSETTLEVOUCHER NOT LIKE 'RV%' 
        AND LASTSETTLEVOUCHER NOT LIKE 'PDC%' 
        AND LASTSETTLEVOUCHER NOT LIKE 'ICA%' 
        AND LASTSETTLEVOUCHER NOT LIKE 'ISW%'
      GROUP BY LEFT(LASTSETTLEVOUCHER, 3)
      ORDER BY TotalQTY DESC
    `)

    return NextResponse.json({
      voucherTypes,
      pdcStatus,
      pdcWithoutSQP_samples: pdcWithoutSQP,
      creditNotes_samples: creditNotes,
      comparison: comparison[0],
      otherVouchers_samples: otherVouchers,
      otherPrefixes
    })
  } catch (error: any) {
    console.error('Debug error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
