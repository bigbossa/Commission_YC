"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Calendar as CalendarIcon, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import * as XLSX from 'xlsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { format } from "date-fns"
import { th } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface OutstandingData {
  EmployeeCode: string
  EmployeeName: string
  TotalQTY: number      // ยอดขาย (INVOICEDATE)
  PaidQTY: number       // ยอดชำระแล้ว (LASTSETTLEDATE)
  OutstandingQTY: number // ยอดค้าง = TotalQTY - PaidQTY
}

interface DetailData {
  ItemNo: string
  SalesId: string
  InvoiceId: string
  LastSettleVoucher: string
  AccountNum: string
  Description: string
  TotalQTY: number
  InvoiceDate?: string
  LastSettleDate: string
  VoucherType?: string
}

interface YearData {
  Year: number
}

export default function OutstandingPage() {
  const [data, setData] = useState<OutstandingData[]>([])
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [filterMode, setFilterMode] = useState<'year' | 'dateRange'>('year')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Dialog state
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<OutstandingData | null>(null)
  const [detailData, setDetailData] = useState<DetailData[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  // Fetch available years
  useEffect(() => {
    async function fetchYears() {
      try {
        const response = await fetch('/api/analytics/years', {
          cache: 'no-store'
        })
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data: YearData[] = await response.json()
        
        if ((data as any).error) {
          throw new Error((data as any).error)
        }
        
        // Convert to Buddhist Era (พ.ศ.)
        const years = data.map(d => d.Year + 543)
        setAvailableYears(years)
        
        // Set default to latest year
        if (years.length > 0) {
          setSelectedYear(years[0])
        }
      } catch (error: any) {
        console.error('Failed to fetch years:', error)
      }
    }

    fetchYears()
  }, [])

  // Fetch outstanding data
  useEffect(() => {
    if (filterMode === 'year' && selectedYear === null) return
    if (filterMode === 'dateRange' && (!startDate || !endDate)) return
    
    let timeoutId: NodeJS.Timeout
    
    async function fetchData() {
      try {
        setLoading(true)
        setError(null)
        
        const controller = new AbortController()
        timeoutId = setTimeout(() => controller.abort(), 20000)
        
        let url = '/api/outstanding'
        const params = new URLSearchParams()
        
        if (filterMode === 'dateRange' && startDate && endDate) {
          const start = format(startDate, 'yyyy-MM-dd')
          const end = format(endDate, 'yyyy-MM-dd')
          params.append('startDate', start)
          params.append('endDate', end)
        } else if (filterMode === 'year' && selectedYear) {
          // Convert Buddhist Era back to Gregorian for API
          const gregorianYear = selectedYear - 543
          params.append('year', gregorianYear.toString())
        }
        
        if (params.toString()) {
          url += `?${params.toString()}`
        }
        
        const response = await fetch(url, {
          signal: controller.signal,
          cache: 'no-store'
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const apiData = await response.json()
        
        if (apiData.error) {
          throw new Error(apiData.error)
        }
        
        // Calculate outstanding for each employee
        const outstandingData: OutstandingData[] = apiData.map((item: any) => ({
          EmployeeCode: item.EmployeeCode,
          EmployeeName: item.EmployeeName,
          TotalQTY: item.TotalQTY || 0,
          PaidQTY: item.PaidQTY || 0,
          OutstandingQTY: (item.TotalQTY || 0) - (item.PaidQTY || 0)
        }))
        
        setData(outstandingData)
      } catch (error: any) {
        console.error('Failed to fetch data:', error)
        if (error.name === 'AbortError') {
          setError('Request timeout - Database connection is taking too long')
        } else {
          setError(error.message || 'Failed to load data')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [selectedYear, startDate, endDate, filterMode])

  // Function to fetch detail data for outstanding (invoices not yet settled)
  const fetchEmployeeDetails = async (employee: OutstandingData) => {
    setSelectedEmployee(employee)
    setDetailDialogOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    setDetailData([])

    try {
      let url = '/api/outstanding/details'
      const params = new URLSearchParams()
      params.append('employeeCode', employee.EmployeeCode)

      if (filterMode === 'dateRange' && startDate && endDate) {
        const start = format(startDate, 'yyyy-MM-dd')
        const end = format(endDate, 'yyyy-MM-dd')
        params.append('startDate', start)
        params.append('endDate', end)
      } else if (filterMode === 'year' && selectedYear) {
        const gregorianYear = selectedYear - 543
        params.append('year', gregorianYear.toString())
      }

      url += `?${params.toString()}`

      const response = await fetch(url, {
        cache: 'no-store'
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setDetailData(data)
    } catch (error: any) {
      console.error('Failed to fetch employee details:', error)
      setDetailError(error.message || 'Failed to load details')
    } finally {
      setDetailLoading(false)
    }
  }

  // Calculate totals
  const totalSales = data.reduce((sum, item) => sum + item.TotalQTY, 0)
  const totalPaid = data.reduce((sum, item) => sum + item.PaidQTY, 0)
  const totalOutstanding = data.reduce((sum, item) => sum + item.OutstandingQTY, 0)

  // Export to Excel
  const exportToExcel = () => {
    const exportData = data.map((item, index) => ({
      'ลำดับ': index + 1,
      'รหัสพนักงาน': item.EmployeeCode,
      'ชื่อพนักงาน': item.EmployeeName,
      'QTY รวม (ยอดขาย)': item.TotalQTY,
      'QTY ที่ชำระแล้ว': item.PaidQTY,
      'QTY ค้างชำระ': item.OutstandingQTY
    }))

    // Add total row
    exportData.push({
      'ลำดับ': '' as any,
      'รหัสพนักงาน': '',
      'ชื่อพนักงาน': 'รวมทั้งหมด',
      'QTY รวม (ยอดขาย)': totalSales,
      'QTY ที่ชำระแล้ว': totalPaid,
      'QTY ค้างชำระ': totalOutstanding
    })

    const ws = XLSX.utils.json_to_sheet(exportData)

    ws['!cols'] = [
      { wch: 8 },
      { wch: 15 },
      { wch: 30 },
      { wch: 18 },
      { wch: 18 },
      { wch: 15 }
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Outstanding')

    let filename = 'Outstanding'
    if (filterMode === 'year' && selectedYear) {
      filename += `_${selectedYear}`
    } else if (filterMode === 'dateRange' && startDate && endDate) {
      filename += `_${format(startDate, 'yyyyMMdd')}-${format(endDate, 'yyyyMMdd')}`
    }
    filename += '.xlsx'

    XLSX.writeFile(wb, filename)
  }

  // Export detail to Excel
  const exportDetailToExcel = () => {
    if (!selectedEmployee || detailData.length === 0) return

    const exportData = detailData.map((item, index) => ({
      'ลำดับ': index + 1,
      'SALESID': item.SalesId,
      'INVOICEID': item.InvoiceId,
      'LASTSETTLEVOUCHER': item.LastSettleVoucher,
      'ประเภท': item.VoucherType === 'CA' || item.VoucherType === 'RV' ? 'เงินสด' : 
               item.VoucherType === 'PDC' ? 'เช็ค' : 
               item.VoucherType === 'ICA' || item.VoucherType === 'ISW' ? 'ใบลดหนี้' :
               item.VoucherType || '-',
      'ACCOUNTNUM': item.AccountNum,
      'INVOICEDATE': item.InvoiceDate ? format(new Date(item.InvoiceDate), 'dd/MM/yyyy') : '-',
      'วันที่ Settle': item.LastSettleDate ? format(new Date(item.LastSettleDate), 'dd/MM/yyyy') : '-',
      'QTY': item.TotalQTY
    }))

    const totalDetailQTY = detailData.reduce((sum, item) => sum + item.TotalQTY, 0)
    exportData.push({
      'ลำดับ': '' as any,
      'SALESID': '',
      'INVOICEID': '',
      'LASTSETTLEVOUCHER': '',
      'ประเภท': '',
      'ACCOUNTNUM': '',
      'INVOICEDATE': '',
      'วันที่ Settle': 'รวมทั้งหมด',
      'QTY': totalDetailQTY
    })

    const ws = XLSX.utils.json_to_sheet(exportData)

    ws['!cols'] = [
      { wch: 8 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 10 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 }
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Outstanding Details')

    let filename = `Outstanding_Detail_${selectedEmployee.EmployeeCode}`
    if (filterMode === 'year' && selectedYear) {
      filename += `_${selectedYear}`
    } else if (filterMode === 'dateRange' && startDate && endDate) {
      filename += `_${format(startDate, 'yyyyMMdd')}-${format(endDate, 'yyyyMMdd')}`
    }
    filename += '.xlsx'

    XLSX.writeFile(wb, filename)
  }

  if (loading && selectedYear === null) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ยอดค้างชำระ</h1>
          <p className="text-muted-foreground mt-2">
            แสดงยอดค้างชำระของแต่ละพนักงาน (QTY รวม - QTY ที่ชำระแล้ว) ไม่รวมเงินสด CA/RV
          </p>
        </div>
        <div className="rounded-lg border bg-card p-8">
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">Loading data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ยอดค้างชำระ</h1>
          <p className="text-muted-foreground mt-2">
            แสดงยอดค้างชำระของแต่ละพนักงาน (QTY รวม - QTY ที่ชำระแล้ว) ไม่รวมเงินสด CA/RV
          </p>
        </div>
        
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={filterMode === 'year' ? 'default' : 'outline'}
              onClick={() => setFilterMode('year')}
              size="sm"
            >
              เลือกปี
            </Button>
            <Button
              variant={filterMode === 'dateRange' ? 'default' : 'outline'}
              onClick={() => setFilterMode('dateRange')}
              size="sm"
            >
              ช่วงวันที่
            </Button>
            
            <Button
              variant="outline"
              onClick={exportToExcel}
              size="sm"
              className="bg-green-600 text-white hover:bg-green-700"
              disabled={loading || data.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>
          
          {filterMode === 'year' ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="lg" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  ปี {selectedYear || 'เลือกปี'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {availableYears.map((year) => (
                  <DropdownMenuItem
                    key={year}
                    onClick={() => setSelectedYear(year)}
                    className={selectedYear === year ? 'bg-accent' : ''}
                  >
                    ปี {year}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy", { locale: th }) : "วันที่เริ่มต้น"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy", { locale: th }) : "วันที่สิ้นสุด"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">QTY รวม (ยอดขาย)</p>
          <p className="text-3xl font-bold text-primary mt-2">
            {totalSales.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">QTY ที่ชำระแล้ว</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">
            {totalPaid.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">QTY ค้างชำระ</p>
          <p className={`text-3xl font-bold mt-2 ${totalOutstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : loading ? (
        <div className="rounded-lg border bg-card p-8">
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">Loading data...</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">
              ยอดค้างชำระรายบุคคล
              {filterMode === 'year' && selectedYear ? ` - ปี ${selectedYear}` : ''}
              {filterMode === 'dateRange' && startDate && endDate 
                ? ` - ${format(startDate, "dd/MM/yyyy")} ถึง ${format(endDate, "dd/MM/yyyy")}`
                : ''
              }
            </h2>
            <div className="text-sm text-muted-foreground mb-4">
              แสดงข้อมูล {data.length} คน | ยอดค้าง = QTY รวม (INVOICEDATE) - QTY ที่ชำระ (LASTSETTLEDATE) | ไม่รวมเงินสด CA/RV
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold bg-primary text-primary-foreground">ลำดับ</TableHead>
                    <TableHead className="font-bold bg-primary text-primary-foreground">รหัสพนักงาน</TableHead>
                    <TableHead className="font-bold bg-primary text-primary-foreground">ชื่อพนักงาน</TableHead>
                    <TableHead className="font-bold bg-primary text-primary-foreground text-right">QTY รวม (ยอดขาย)</TableHead>
                    <TableHead className="font-bold bg-primary text-primary-foreground text-right">QTY ที่ชำระแล้ว</TableHead>
                    <TableHead className="font-bold bg-primary text-primary-foreground text-right">QTY ค้างชำระ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item, index) => (
                    <TableRow key={item.EmployeeCode} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>
                        <button
                          onClick={() => fetchEmployeeDetails(item)}
                          className="text-primary hover:underline font-medium"
                        >
                          {item.EmployeeCode}
                        </button>
                      </TableCell>
                      <TableCell>{item.EmployeeName}</TableCell>
                      <TableCell className="text-right font-medium">
                        {item.TotalQTY.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-medium text-blue-600">
                        {item.PaidQTY.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${item.OutstandingQTY > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {item.OutstandingQTY.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total Row */}
                  <TableRow className="bg-muted/50 font-bold border-t-2">
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="font-bold">รวมทั้งหมด</TableCell>
                    <TableCell className="text-right font-bold">
                      {totalSales.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-bold text-blue-600">
                      {totalPaid.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className={`text-right font-bold ${totalOutstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              รายละเอียดยอดค้างชำระ - {selectedEmployee?.EmployeeCode}
            </DialogTitle>
            <DialogDescription>
              {selectedEmployee?.EmployeeName} | ยอดค้าง: {selectedEmployee?.OutstandingQTY.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} QTY
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            {detailLoading ? (
              <div className="space-y-4 p-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : detailError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{detailError}</AlertDescription>
              </Alert>
            ) : detailData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                ไม่พบรายการค้างชำระ (รายการทั้งหมดชำระแล้วในช่วงเวลานี้)
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">
                    พบ {detailData.length} รายการ | รวม QTY: {detailData.reduce((sum, item) => sum + item.TotalQTY, 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </div>
                  <Button
                    variant="outline"
                    onClick={exportDetailToExcel}
                    size="sm"
                    className="bg-green-600 text-white hover:bg-green-700"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Excel
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-bold">ลำดับ</TableHead>
                      <TableHead className="font-bold">SALESID</TableHead>
                      <TableHead className="font-bold">INVOICEID</TableHead>
                      <TableHead className="font-bold">VOUCHER</TableHead>
                      <TableHead className="font-bold">ประเภท</TableHead>
                      <TableHead className="font-bold">ACCOUNTNUM</TableHead>
                      <TableHead className="font-bold">INVOICEDATE</TableHead>
                      <TableHead className="font-bold">SETTLEDATE</TableHead>
                      <TableHead className="font-bold text-right">QTY</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailData.map((item, index) => (
                      <TableRow key={`${item.SalesId}-${item.InvoiceId}-${index}`}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-mono text-sm">{item.SalesId}</TableCell>
                        <TableCell className="font-mono text-sm">{item.InvoiceId}</TableCell>
                        <TableCell className="font-mono text-sm">{item.LastSettleVoucher}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            item.VoucherType === 'PDC' ? 'bg-blue-100 text-blue-800' :
                            item.VoucherType === 'ICA' || item.VoucherType === 'ISW' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {item.VoucherType === 'PDC' ? 'เช็ค' : 
                             item.VoucherType === 'ICA' || item.VoucherType === 'ISW' ? 'ใบลดหนี้' :
                             item.VoucherType || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.AccountNum}</TableCell>
                        <TableCell>
                          {item.InvoiceDate ? format(new Date(item.InvoiceDate), 'dd/MM/yyyy') : '-'}
                        </TableCell>
                        <TableCell>
                          {item.LastSettleDate ? format(new Date(item.LastSettleDate), 'dd/MM/yyyy') : '-'}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${item.TotalQTY < 0 ? 'text-red-600' : ''}`}>
                          {item.TotalQTY.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Total Row */}
                    <TableRow className="bg-muted/50 font-bold border-t-2">
                      <TableCell colSpan={8} className="text-right font-bold">รวมทั้งหมด</TableCell>
                      <TableCell className="text-right font-bold">
                        {detailData.reduce((sum, item) => sum + item.TotalQTY, 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
