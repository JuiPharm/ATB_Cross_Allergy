# BHH Cross Allergy Checker — GitHub Pages Static Web App

เวอร์ชันนี้ออกแบบใหม่จากไฟล์แนบเดิมให้เหมาะกับการ Deploy บน **GitHub Pages** โดยตรง  
ไม่ต้องใช้ Node.js, ไม่ต้อง build, ไม่ต้องมี server และไม่ต้องใช้ `google.script.run` สำหรับข้อมูลหลัก

## สรุปข้อมูลที่แปลงจาก Excel

- จำนวนคู่ความสัมพันธ์: **171**
- จำนวนรายการยา: **19**
- DO NOT PRESCRIBE: **42**
- CONSIDERED SAFE: **129**

## โครงสร้างไฟล์

```text
/
├── index.html
├── .nojekyll
├── README.md
├── data/
│   └── cross_allergy.json
├── assets/
│   ├── favicon.svg
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── config.js
│       └── app.js
└── apps-script/
    └── Code.gs   # optional เฉพาะกรณีต้องการดึงข้อมูลจาก Google Sheet หรือเก็บ search log
```

## Features

- GitHub Pages ready: static HTML/CSS/JS
- ใช้ข้อมูลจาก `data/cross_allergy.json`
- ค้นหาชื่อยาแบบ exact match และ partial search
- แสดงผล 2 กลุ่ม: `DO NOT PRESCRIBE` และ `CONSIDERED SAFE`
- ตารางฐานข้อมูลพร้อม filter
- Graph ความสัมพันธ์ด้วย vis-network CDN
- Copy summary และ Export CSV
- Responsive UI ตามแนวทาง premium hospital / Bangkok Hospital CI
- ลดความเสี่ยง XSS โดย render รายการผลลัพธ์ด้วย `textContent`/DOM API แทนการต่อ `innerHTML` จากข้อมูลยา

## วิธี Deploy บน GitHub Pages แบบ Step by step

### วิธีที่ 1: ใช้ Repository ใหม่

1. สร้าง GitHub repository ใหม่ เช่น `BHH_Cross_Allergy_Checker`
2. แตกไฟล์ zip นี้
3. Upload ไฟล์ทั้งหมดขึ้น GitHub โดยวางไว้ที่ root ของ repository
4. ไปที่ `Settings`
5. เลือก `Pages`
6. ที่หัวข้อ `Build and deployment`
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
7. กด `Save`
8. รอ GitHub Pages build เสร็จ
9. เปิดเว็บที่ URL รูปแบบนี้

```text
https://<username>.github.io/<repository-name>/
```

ตัวอย่าง:

```text
https://JuiPharm.github.io/BHH_Cross_Allergy_Checker/
```

### วิธีที่ 2: ใช้ repository เดิม

1. เปิด repository เดิม
2. Upload/แทนที่ไฟล์เหล่านี้ที่ root
   - `index.html`
   - `assets/`
   - `data/`
   - `.nojekyll`
3. Commit changes
4. ตรวจสอบ Settings → Pages ว่าใช้ Branch `main` และ Folder `/ (root)`
5. เปิด URL GitHub Pages อีกครั้ง

## การแก้ไขฐานข้อมูลยาในอนาคต

### ทางเลือก A: แก้ JSON โดยตรง

แก้ไฟล์:

```text
data/cross_allergy.json
```

รูปแบบข้อมูลแต่ละคู่:

```json
{
  "id": "rel-001",
  "drug_a": "AMOXICILLIN",
  "drug_b": "AMPICILLIN",
  "result": "X1",
  "result_code": "DO_NOT_PRESCRIBE",
  "description": "Same side chain - clinical evidence of cross reaction"
}
```

หลังแก้ไข ให้ commit และรอ GitHub Pages update

### ทางเลือก B: ใช้ Google Sheets + Apps Script แบบ optional

เหมาะเมื่ออยากให้ผู้ดูแลแก้ข้อมูลใน Google Sheets แล้วเว็บอ่านข้อมูลล่าสุดจาก Sheet

1. เปิด Google Sheet ที่มีชีต `Data`
2. Headers ต้องเป็น:

```text
drug_a | drug_b | result | result_code | description
```

3. เปิด Apps Script
4. วาง code จาก `apps-script/Code.gs`
5. ตั้ง Script Properties:
   - `SHEET_ID` = Google Sheet ID
6. Deploy เป็น Web app
   - Execute as: `Me`
   - Who has access: `Anyone`
7. Copy URL ที่ลงท้าย `/exec`
8. แก้ไฟล์ `assets/js/config.js`

```js
window.APP_CONFIG = {
  APP_VERSION: "1.0.0",
  USE_REMOTE_API: true,
  LOCAL_DATA_URL: "data/cross_allergy.json",
  GAS_API_URL: "https://script.google.com/macros/s/xxxxx/exec",
  ENABLE_REMOTE_LOGGING: true,
  HOSPITAL_NAME: "Bangkok Hospital Hatyai",
};
```

> หมายเหตุ: GitHub Pages เป็น static hosting จึงเรียก `google.script.run` ไม่ได้ ต้องใช้ static JSON หรือ JSONP endpoint จาก Apps Script เท่านั้น

## ทดสอบก่อน Deploy

เพราะ browser บางตัวไม่อนุญาตให้ `fetch()` ไฟล์ JSON จาก `file://` โดยตรง แนะนำให้ทดสอบผ่าน local server

```bash
python -m http.server 8080
```

แล้วเปิด:

```text
http://localhost:8080
```

## Clinical note

ระบบนี้เป็นเครื่องมือช่วยคัดกรองเพื่อความปลอดภัยด้านยาเท่านั้น ไม่ใช่คำสั่งการรักษาอัตโนมัติ  
ควรตรวจสอบประวัติแพ้ยา ความรุนแรง รายละเอียดอาการ และแนวทางของโรงพยาบาลก่อนสั่งใช้ยาเสมอ
