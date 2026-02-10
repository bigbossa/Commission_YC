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
        
        let url = '/api/analytics'
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

  if (loading && selectedYear === null) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ยอดค้างชำระ</h1>
          <p className="text-muted-foreground mt-2">
            แสดงยอดค้างชำระของแต่ละพนักงาน (QTY รวม - QTY ที่ชำระแล้ว)
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
            แสดงยอดค้างชำระของแต่ละพนักงาน (QTY รวม - QTY ที่ชำระแล้ว)
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
              แสดงข้อมูล {data.length} คน | ยอดค้าง = QTY รวม (INVOICEDATE) - QTY ที่ชำระ (LASTSETTLEDATE)
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
                      <TableCell className="font-medium">{item.EmployeeCode}</TableCell>
                      <TableCell className="font-medium">{item.EmployeeName}</TableCell>
                      <TableCell className="text-right font-mono text-lg text-primary font-semibold">
                        {item.TotalQTY.toLocaleString('en-US', { 
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2 
                        })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-lg text-blue-600 font-semibold">
                        {item.PaidQTY.toLocaleString('en-US', { 
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2 
                        })}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-lg font-semibold ${
                        item.OutstandingQTY > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {item.OutstandingQTY.toLocaleString('en-US', { 
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2 
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted font-bold border-t-2 border-primary">
                    <TableCell className="font-bold"></TableCell>
                    <TableCell className="font-bold text-lg" colSpan={2}>รวมทั้งหมด</TableCell>
                    <TableCell className="text-right font-mono text-xl text-primary">
                      {totalSales.toLocaleString('en-US', { 
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2 
                      })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xl text-blue-600">
                      {totalPaid.toLocaleString('en-US', { 
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2 
                      })}
                    </TableCell>
                    <TableCell className={`text-right font-mono text-xl ${
                      totalOutstanding > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {totalOutstanding.toLocaleString('en-US', { 
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2 
                      })}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
