"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Calendar as CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
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

interface AnalyticsData {
  EmployeeCode: string
  EmployeeName: string
  BPC_DIMENSION5_: string
  TotalQTY: number
}

interface AnalyticsDetailData {
  ItemNo: string
  SalesId: string
  InvoiceId: string
  LastSettleVoucher: string
  RecId: string
  Description: string
  TotalQTY: number
  LastSettleDate: string
}

interface YearData {
  Year: number
}

interface DimensionData {
  BPC_DIMENSION5_: string
}

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([])
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [availableDimensions, setAvailableDimensions] = useState<string[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedDimension, setSelectedDimension] = useState<string | null>(null)
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [filterMode, setFilterMode] = useState<'year' | 'dateRange'>('year')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Dialog state
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<AnalyticsData | null>(null)
  const [detailData, setDetailData] = useState<AnalyticsDetailData[]>([])
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
        
        if (data.error) {
          throw new Error(data.error)
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

  // Fetch available dimensions
  useEffect(() => {
    async function fetchDimensions() {
      try {
        const response = await fetch('/api/analytics/dimensions', {
          cache: 'no-store'
        })
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data: DimensionData[] = await response.json()
        
        if (data.error) {
          throw new Error(data.error)
        }
        
        const dimensions = data.map(d => d.BPC_DIMENSION5_)
        setAvailableDimensions(dimensions)
      } catch (error: any) {
        console.error('Failed to fetch dimensions:', error)
      }
    }

    fetchDimensions()
  }, [])

  // Fetch analytics data
  useEffect(() => {
    if (filterMode === 'year' && selectedYear === null) return
    if (filterMode === 'dateRange' && (!startDate || !endDate)) return
    
    let timeoutId: NodeJS.Timeout
    
    async function fetchAnalytics() {
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
        
        if (selectedDimension) {
          params.append('dimension', selectedDimension)
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
        
        const data = await response.json()
        
        if (data.error) {
          throw new Error(data.error)
        }
        
        setAnalyticsData(data)
      } catch (error: any) {
        console.error('Failed to fetch analytics:', error)
        if (error.name === 'AbortError') {
          setError('Request timeout - Database connection is taking too long')
        } else {
          setError(error.message || 'Failed to load analytics data')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [selectedYear, startDate, endDate, filterMode, selectedDimension])

  // Function to fetch detail data
  const fetchEmployeeDetails = async (employee: AnalyticsData) => {
    setSelectedEmployee(employee)
    setDetailDialogOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    setDetailData([])

    try {
      let url = '/api/analytics/details'
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

      if (selectedDimension) {
        params.append('dimension', selectedDimension)
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

  if (loading && selectedYear === null) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-2">
            QTY Summary by BPC_DIMENSION5_ from SALESCOMMISSION_Cache
          </p>
        </div>
        <div className="rounded-lg border bg-card p-8">
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">Loading analytics data...</p>
        </div>
      </div>
    )
  }

  // Calculate total
  const totalQTY = analyticsData.reduce((sum, item) => sum + item.TotalQTY, 0)

  // Calculate commission based on progressive rates
  const calculateCommission = (qty: number) => {
    if (qty <= 1000) {
      return qty * 5
    } else {
      const first1000 = 1000 * 5  // 5,000
      const remaining = (qty - 1000) * 8
      return first1000 + remaining
    }
  }

  // Calculate average commission rate
  const calculateAvgRate = (qty: number) => {
    if (qty === 0) return 0
    const commission = calculateCommission(qty)
    return commission / qty
  }

  // Add commission calculation to each row
  const analyticsWithCommission = analyticsData.map(item => {
    const commission = calculateCommission(item.TotalQTY)
    const avgRate = calculateAvgRate(item.TotalQTY)
    return {
      ...item,
      Commission: commission,
      AvgRate: avgRate
    }
  })

  const totalCommission = analyticsWithCommission.reduce((sum, item) => sum + item.Commission, 0)

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-2">
            QTY Summary by BPC_DIMENSION5_ from SALESCOMMISSION_Cache (LASTSETTLEDATE)
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
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {selectedDimension || 'BPC_DIMENSION5_: ทั้งหมด'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-[300px] overflow-y-auto">
                <DropdownMenuItem
                  onClick={() => setSelectedDimension(null)}
                  className={!selectedDimension ? 'bg-accent' : ''}
                >
                  ทั้งหมด
                </DropdownMenuItem>
                {availableDimensions.map((dim) => (
                  <DropdownMenuItem
                    key={dim}
                    onClick={() => setSelectedDimension(dim)}
                    className={selectedDimension === dim ? 'bg-accent' : ''}
                  >
                    {dim}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
        <>
          <div className="rounded-lg border bg-card">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">
                QTY by BPC_DIMENSION5_{filterMode === 'year' && selectedYear ? ` - ปี ${selectedYear}` : ''}
                {filterMode === 'dateRange' && startDate && endDate 
                  ? ` - ${format(startDate, "dd/MM/yyyy")} ถึง ${format(endDate, "dd/MM/yyyy")}`
                  : ''
                }
                {selectedDimension ? ` - ${selectedDimension}` : ''}
              </h2>
              <div className="text-sm text-muted-foreground mb-4">
                แสดงข้อมูล {analyticsWithCommission.length} รายการ | สูตร Commission: 1,000 แรก × 5 บาท, เกิน 1,000 × 8 บาท
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-bold bg-primary text-primary-foreground">ลำดับ</TableHead>
                      <TableHead className="font-bold bg-primary text-primary-foreground">รหัสพนักงาน</TableHead>
                      <TableHead className="font-bold bg-primary text-primary-foreground">ชื่อพนักงาน</TableHead>
                      <TableHead className="font-bold bg-primary text-primary-foreground text-right">QTY รวม</TableHead>
                      <TableHead className="font-bold bg-primary text-primary-foreground text-right">อัตราเฉลี่ย (บาท/QTY)</TableHead>
                      <TableHead className="font-bold bg-primary text-primary-foreground text-right">Commission (บาท)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analyticsWithCommission.map((item, index) => (
                      <TableRow key={item.BPC_DIMENSION5_} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell className="font-medium">
                          <button 
                            onClick={() => fetchEmployeeDetails(item)}
                            className="text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer font-medium"
                          >
                            {item.EmployeeCode}
                          </button>
                        </TableCell>
                        <TableCell className="font-medium">{item.EmployeeName}</TableCell>
                        <TableCell className="text-right font-mono text-lg text-primary font-semibold">
                          {item.TotalQTY.toLocaleString('en-US', { 
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2 
                          })}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-amber-600">
                          {item.AvgRate.toLocaleString('en-US', { 
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2 
                          })}
                        </TableCell>
                        <TableCell className="text-right font-mono text-lg text-green-600 font-semibold">
                          {item.Commission.toLocaleString('en-US', { 
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2 
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted font-bold border-t-2 border-primary">
                      <TableCell className="font-bold"></TableCell>
                      <TableCell className="font-bold text-lg" colSpan={2}>รวมทั้งหมด</TableCell>
                      <TableCell className="text-right font-mono text-xl text-primary">
                        {totalQTY.toLocaleString('en-US', { 
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2 
                        })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-amber-600">
                        {calculateAvgRate(totalQTY).toLocaleString('en-US', { 
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2 
                        })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xl text-green-600">
                        {totalCommission.toLocaleString('en-US', { 
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2 
                        })}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="!max-w-none w-[calc(100vw-40px)] max-h-[90vh] overflow-y-auto mx-5">
          <DialogHeader>
            <DialogTitle>
              รายละเอียด QTY - {selectedEmployee?.EmployeeCode} {selectedEmployee?.EmployeeName}
            </DialogTitle>
            <DialogDescription>
              แสดงรายละเอียดการขายทั้งหมดที่นำมารวม QTY
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 w-full">
            {detailLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <p className="text-center text-sm text-muted-foreground mt-4">กำลังโหลดข้อมูล...</p>
              </div>
            ) : detailError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{detailError}</AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="mb-4 p-4 bg-muted rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">จำนวนรายการทั้งหมด</p>
                      <p className="text-2xl font-bold">{detailData.length.toLocaleString()} รายการ</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">QTY รวม</p>
                      <p className="text-2xl font-bold text-primary">
                        {detailData.reduce((sum, item) => sum + item.TotalQTY, 0).toLocaleString('en-US', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto w-full">
                  <Table className="w-full min-w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-bold bg-primary text-primary-foreground w-16">ลำดับ</TableHead>
                        <TableHead className="font-bold bg-primary text-primary-foreground min-w-[180px]">SALESID</TableHead>
                        <TableHead className="font-bold bg-primary text-primary-foreground min-w-[180px]">INVOICEID</TableHead>
                        <TableHead className="font-bold bg-primary text-primary-foreground min-w-[200px]">LASTSETTLEVOUCHER</TableHead>
                        <TableHead className="font-bold bg-primary text-primary-foreground min-w-[150px]">RECID</TableHead>
                        <TableHead className="font-bold bg-primary text-primary-foreground min-w-[120px]">วันที่ Settle</TableHead>
                        <TableHead className="font-bold bg-primary text-primary-foreground text-right min-w-[100px]">QTY</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            ไม่พบข้อมูล
                          </TableCell>
                        </TableRow>
                      ) : (
                        detailData.map((item, index) => (
                          <TableRow key={index} className="hover:bg-muted/50">
                            <TableCell className="font-medium">{index + 1}</TableCell>
                            <TableCell className="font-mono text-xs">{item.SalesId}</TableCell>
                            <TableCell className="font-mono text-xs">{item.InvoiceId}</TableCell>
                            <TableCell className="font-mono text-xs">{item.LastSettleVoucher}</TableCell>
                            <TableCell className="font-mono text-xs">{item.RecId}</TableCell>
                            <TableCell>
                              {item.LastSettleDate ? format(new Date(item.LastSettleDate), "dd/MM/yyyy", { locale: th }) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-primary font-semibold">
                              {item.TotalQTY.toLocaleString('en-US', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2
                              })}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
