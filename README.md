# Commission Dashboard

แดชบอร์ดสำหรับจัดการและวิเคราะห์ข้อมูล Commission จากระบบ SALESCOMMISSION_Cache

## Features

- 📊 **Analytics Dashboard** - วิเคราะห์ QTY และ Commission แบ่งตาม BPC_DIMENSION5_
- 📅 **ฟิลเตอร์แบบยืดหยุ่น** - เลือกตามปี (พ.ศ.) หรือช่วงวันที่
- 💰 **คำนวณ Commission อัตโนมัติ** - สูตรแบบขั้นบันได (1,000 แรก × 5 บาท, เกิน 1,000 × 8 บาท)
- 📦 **Products Page** - แสดงข้อมูลจาก SALESCOMMISSION_Cache
- 💼 **Sales Page** - แสดงข้อมูลจาก CustSettle_Cache
- 🔄 **PostgreSQL Sync** - ซิงค์ข้อมูลไปยัง PostgreSQL
- 🎨 **Theme Toggle** - รองรับ Light/Dark Mode

## Tech Stack

- **Framework**: Next.js 16.0.10 (App Router, Turbopack)
- **Language**: TypeScript
- **Database**: SQL Server, PostgreSQL
- **UI**: Tailwind CSS, shadcn/ui
- **Libraries**: mssql, pg, date-fns, next-themes

## Prerequisites

- Node.js 18+ 
- pnpm (หรือ npm/yarn)
- SQL Server (192.168.2.26 หรือแก้ไขตาม .env)
- PostgreSQL (optional - สำหรับ sync feature)

## Installation

```bash
# Clone repository
git clone <repository-url>
cd commission-dashboard-table

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# แก้ไขค่าใน .env.local ตามของคุณ
```

## Environment Variables

สร้างไฟล์ `.env.local` และกรอกข้อมูลต่อไปนี้:

```env
# SQL Server Configuration
MSSQL_USER=sa
MSSQL_PASSWORD=your_password
MSSQL_SERVER=localhost
MSSQL_DATABASE=UAT_Cache
MSSQL_ENCRYPT=false
MSSQL_TRUST_SERVER_CERTIFICATE=true

# PostgreSQL Configuration (optional)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=commission_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
```

## Running the Application

```bash
# Development mode (port 3333)
npm dev

# Build for production
npm build

# Start production server
npm start
```

เปิดเบราว์เซอร์ที่ [http://localhost:3333](http://localhost:3333)

## Project Structure

```
├── app/
│   ├── analytics/          # Analytics Dashboard
│   ├── products/           # SALESCOMMISSION_Cache
│   ├── sales/              # CustSettle_Cache
│   └── api/                # API Routes
├── components/
│   ├── ui/                 # shadcn/ui components
│   └── ...                 # Custom components
├── lib/
│   ├── db.ts              # SQL Server connection
│   └── postgres.ts        # PostgreSQL connection
└── .env.local             # Environment variables (not in git)
```

## Database Schema

### SALESCOMMISSION_Cache
- **BPC_DIMENSION5_**: หมวดหมู่สินค้า
- **LASTSETTLEDATE**: วันที่ตัดยอด
- **QTY**: จำนวน
- และอื่นๆ (28 columns total)

### CustSettle_Cache
- ข้อมูลลูกค้าและการตัดยอด

## Commission Calculation Formula

```typescript
if (qty <= 1000) {
  commission = qty × 5
} else {
  commission = (1000 × 5) + ((qty - 1000) × 8)
}

// ตัวอย่าง: 2,000 QTY
// = (1,000 × 5) + (1,000 × 8)
// = 5,000 + 8,000
// = 13,000 บาท
// อัตราเฉลี่ย = 13,000 / 2,000 = 6.5 บาท/QTY
```

## Features Details

### Analytics Dashboard
- กรองตามปี (พ.ศ.) หรือช่วงวันที่
- กรองตาม BPC_DIMENSION5_
- แสดงตารางสรุป QTY, Commission, อัตราเฉลี่ย
- คำนวณ Commission อัตโนมัติตามสูตร

### Products Page
- แสดงข้อมูลจาก SALESCOMMISSION_Cache
- Pagination (50 รายการต่อหน้า)
- แสดงทุก column (28 columns)

### Sales Page
- แสดงข้อมูลจาก CustSettle_Cache
- Pagination
- รองรับการแสดงข้อมูลลูกค้า

## API Endpoints

- `GET /api/analytics` - ดึงข้อมูล Analytics (รองรับ query: year, startDate, endDate, dimension)
- `GET /api/analytics/years` - ดึงรายการปีที่มีข้อมูล
- `GET /api/analytics/dimensions` - ดึงรายการ BPC_DIMENSION5_
- `GET /api/products` - ดึงข้อมูล SALESCOMMISSION_Cache
- `GET /api/sales` - ดึงข้อมูล CustSettle_Cache
- `POST /api/sync-to-postgres` - ซิงค์ข้อมูลไปยัง PostgreSQL

## Notes
เช็ค 
จะเปิดบิลจาก SALESCOMMISSION_Cache จากนั้นจะได้ เลข LASTSETTLEVOUCHER ที่เป็น PDC จากนั้นข้อมูลจะเข้า Settlement Data ที่มี VOUCHER เป็น PDC ที่ตรงกับ LASTSETTLEVOUCHER ของตาราง SALESCOMMISSION_Cache และจะได้ OFFSETTRANSVOUCHER ที่มี SM เมื่อมีการชำระเข้ามา SM จะเป็นเลข  VOUCHER และ ได้ OFFSETTRANSVOUCHER ที่อ้างอิงกับ VOUCHER ที่เป็น PDC และ ต้องเอา INVOICEDATE ของ Customer Settlement ใช้เป็นเดือนที่จ่ายค่า Commission 
เช็ค 1 ใบ มีมากกว่า  1 อย่างได้ 

ต่อมา จะมีการคืนของ เรียกว่า ใบลดหนี้
SALESCOMMISSION_Cache
ช่อง LASTSETTLEVOUCHER จะมี i นำหน้า เช่น ica isw จากนั้นเอาไปตรวจสอบ ในตาราง CustSettle_Cache ตาราง VOUCHER ICA กะ CA

เพิ่มอีกออย่างคือ QTY ที่ชำระแล้ว
QTY รวม คือ ยอดขายของ ช่วงเวลานั้น ที่เลือก และ ผ่านสูตรคิดค่าเฉลี่ยน อัตราเฉลี่ย (บาท/QTY) แล้ว จากนั้น เพิ่มแอีกช่องคือ QTY ที่ชำระแล้ว แล้วถึงนำค่า QTYที่ชำระแล้วมา * กับ อัตราเฉลี่ย (บาท/QTY) จะได้ค่า Commission (บาท)

- Server รันที่ port 3333 (กำหนดใน package.json)
- ข้อมูล QTY ที่เป็นค่าลบจะถูกกรองออก (QTY > 0)
- Theme เริ่มต้นคือ Light Mode
- Connection pooling สูงสุด 10 connections
- Request timeout: 15 วินาที

## License

line 0987439887

## Support

หากพบปัญหาหรือมีคำถาม กรุณาติดต่อทีมพัฒนา
