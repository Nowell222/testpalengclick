# FORMAL BUSINESS PROPOSAL & COMMERCIAL QUOTATION

**Project Title:** PALENG-CLICK CONNECT: Municipal Public Market Digital Management & Cashiering System  
**Target Client:** Municipal Government / Local Government Unit (LGU)  
**Procurement Classification:** Alternative Mode of Procurement – Small Value Procurement (SVP, Sec. 53.9, R.A. 9184)  
**Budget Ceiling:** Below ₱ 100,000.00 (No Public Competitive Bidding Required)  
**Proposal Reference:** PC-LGU-2026-001  
**Validity:** 60 Calendar Days  
**Currency:** Philippine Peso (PHP / ₱)

---

## 1. Legal Procurement Justification (R.A. 9184 Compliance)

> **Exemption from Public Bidding:**  
> Under the **2016 Revised Implementing Rules and Regulations (IRR) of Republic Act No. 9184 (Government Procurement Reform Act), Section 53.9**, procurement of goods and consulting services where the amount does not exceed the threshold of **₱ 100,000.00** qualifies under **Negotiated Procurement – Small Value Procurement (SVP)**.
> 
> * **No Public Bidding Required:** This project does not require prolonged public competitive bidding or PhilGEPS bidding procedures.
> * **Direct Purchase Order (PO):** The Municipal Mayor and Bids and Awards Committee (BAC) can directly approve and award the contract via a standard Purchase Request (PR) and Notice to Proceed (NTP).

---

## 2. System Scope & Core Deliverables

**Paleng-Click Connect** is a complete, web-based municipal public market governance and digital revenue collection platform aligned with the national **DILG-BSP Paleng-QR Ph Plus** initiative:

* **Market Administrator Portal:** Section & stall mapping, square-meter rental computations, multi-year rate schedules (2026–2028), automated 25% late payment penalty calculations, and real-time revenue collection dashboards.
* **Offline-Ready Cashiering (PWA):** Equipped with IndexedDB offline sync, enabling treasury cashiers and market collectors to accept payments, issue official PDF receipts, and balance daily cash shifts even during power outages or intermittent market internet.
* **Vendor Self-Service Portal:** Vendors can check their Statement of Account (SOA), historical arrears, and settle stall fees online via **QR Ph, GCash, Maya**, or online banking.
* **Smart OCR Receipt Verification:** Built-in AI receipt auditor (Google Gemini + Tesseract OCR) that automatically validates reference numbers, dates, and amounts for bank and e-wallet transfers.
* **BPLO & Regulatory Clearance Module:** Integration for business permits, sanitary inspections, and transient (*bolante*) vendor tickets.

---

## 3. Commercial Package Options (Under ₱100k Procurement Ceiling)

The municipality may select between two procurement pathways based on preferred administrative turnaround:

```
Standard Enterprise System License & Deployment:    ₱ 220,000.00
Less: Pioneer LGU Digitalization Subsidy / Grant:  - ₱ 121,500.00
=================================================================
TOTAL CONTRACT PRICE (Year 1 Turnkey Package):        ₱  98,500.00  (VAT Inclusive)
```

### Option A: Single Turnkey Purchase Order (₱ 98,500.00)
*(Standard Small Value Procurement with routine 3-day PhilGEPS bulletin posting)*

| Item | Scope & Deliverables | Standard Value | Net Quoted Price |
| :--- | :--- | :--- | :--- |
| **1. Core System License** | Full municipal perpetual license for Admin, Cashier, BPLO, and Vendor portals with unlimited stalls/vendors. | ₱ 110,000.00 | **₱ 48,500.00** |
| **2. Ordinance & Rate Engine Setup** | Encoding local sqm rental formulas, multi-year rate tables, and official LGU-branded PDF receipt layouts. | ₱ 35,000.00 | **₱ 16,500.00** |
| **3. Masterlist Data Migration** | Cleaning, formatting, and batch-importing existing vendor lists, stall allocations, and balances via CSV. | ₱ 25,000.00 | **₱ 11,500.00** |
| **4. Payment Gateway Integration** | Setup of PayMongo or Xendit for QR Ph, GCash, Maya, and direct LGU depository bank settlement. | ₱ 30,000.00 | **₱ 12,000.00** |
| **5. Capacity Building & Staff Training** | Comprehensive training for Cashiers, Collectors, and Admin staff with training manuals and digital guides. | ₱ 20,000.00 | **₱ 10,000.00** |
| **6. Year 1 Cloud Infrastructure** | Supabase Database, Vercel Edge Hosting, SSL Security, AI OCR, and Web Push Alerts. | ₱ 35,000.00 | **FREE (Included)** |
| **TOTAL CONTRACT PRICE (Option A)** | **Full Turnkey Implementation (CapEx)** | **₱ 220,000.00** | **₱ 98,500.00** |

---

### Option B: Two-Phased Accelerated Purchase Orders (₱ 49,000.00 + ₱ 45,000.00)
*(Under Sec. 54.2 of R.A. 9184, procurements of **₱ 50,000.00 and below are 100% EXEMPT from PhilGEPS posting** — 0 days waiting time, immediate direct issuance of PO)*

| Purchase Order Phase | Scope & Deliverables | Procurement Classification | Amount |
| :--- | :--- | :--- | :--- |
| **Phase 1: Software License**<br><small>(PO 1 - Immediate)</small> | Perpetual software license, core portal architecture, database schema, and initial municipal user accounts. | Capital Outlay (Goods / IT Software) | **₱ 49,000.00** |
| **Phase 2: Technical Setup & Training**<br><small>(PO 2 - Rollout)</small> | Ordinance rate configuration, vendor CSV data migration, PayMongo/Xendit gateway integration, and staff training. | MOOE (Technical / Consultancy Services) | **₱ 45,000.00** |
| **COMBINED TOTAL (Option B)** | **Zero PhilGEPS Posting Route** | | **₱ 94,000.00** |

---

## 4. Year 1 Cloud Infrastructure & Subscriptions (Included at ₱0)

All cloud services for Year 1 are **bundled at no additional cost**:

* **Municipal Domain & SSL:** Support for official `.gov.ph` (free via DICT) or custom `.ph` domain with automated SSL encryption.
* **Cloud Database (Supabase PostgreSQL):** High-availability cloud database with automated daily backups and secure storage for scanned receipts and permits.
* **Edge Web Hosting (Vercel / Cloudflare):** 99.99% uptime SLA, global CDN, and PWA offline caching.
* **AI Receipt OCR Engine:** Hybrid Google Gemini API and client-side Tesseract OCR for automatic verification of digital receipts.
* **Web Push Notifications:** Native browser alerts and payment due reminders for registered vendors.

---

## 5. Payment Gateway Fee Schedule (PayMongo vs. Xendit)

> **Note on Gateways:**  
> Gateways charge **₱0.00 setup fees** and **₱0.00 monthly maintenance fees**. Transaction convenience fees are passed through to the paying vendor/payer:

| Payment Channel | PayMongo Rate | Xendit Rate | Remittance Schedule |
| :--- | :--- | :--- | :--- |
| **QR Ph (National Interoperable QR)** | 1.50% | 1.20% – 1.40% | Direct to LGU Landbank / DBP (T+1 to T+2) |
| **GCash / Maya Direct** | 2.00% – 2.50% | 1.80% – 2.00% | Direct to LGU Landbank / DBP (T+1 to T+2) |
| **Online Banking (Direct Debit)** | ₱ 15.00 flat | ₱ 10.00 – ₱ 15.00 flat | Direct to LGU Landbank / DBP (T+1 to T+2) |

---

## 6. Maintenance & Service Level Agreement (SLA) — Separate MOOE

To maintain the system's longevity without bloating the initial procurement cost, maintenance is billed as a separate, recurring operating expense:

* **Complimentary Warranty:** **First 90 Days Free** after system turnover (covers all bug fixes, system adjustments, and cashier workflow fine-tuning).
* **Annual Maintenance & Support Contract (Starting Year 2):**
  * **Option 1: Basic Cloud Hosting & Database Renewal:** **₱ 12,000.00 / year** *(₱1,000/mo)*
  * **Option 2: Comprehensive SLA & Technical Support (Recommended):** **₱ 24,000.00 / year** *(₱2,000/mo)*  
    *(Includes cloud renewals, automated backups, annual ordinance rate updates like 2027/2028 adjustments, and priority helpdesk for Treasury cashiers).*

*(Note: This maintenance fee is charged annually under the LGU’s **Maintenance and Other Operating Expenses (MOOE)** budget and does not count against the initial ₱100,000 CapEx procurement limit).*

---

## 7. Implementation Timeline (4 Weeks)

* **Week 1:** Ordinance review, rate matrix alignment, and stall mapping.
* **Week 2:** System branding, gateway setup (PayMongo/Xendit merchant verification), and data migration.
* **Week 3:** Cashier and market collector testing, dry-run simulations, and UAT.
* **Week 4:** Staff training, official turnover, and deployment.

---

## 8. Terms of Payment (Standard LGU Tranches for Option A)

1. **Advance Payment / Mobilization (15% - ₱ 14,775.00):** Upon issuance of Notice to Proceed (NTP) / Purchase Order (PO).
2. **Progress Billing (45% - ₱ 44,325.00):** Upon completion of system customization, gateway setup, and successful data migration.
3. **Final Settlement (40% - ₱ 39,400.00):** Upon completion of staff training, User Acceptance Testing (UAT) sign-off, and official turnover.

---

### Acceptance & Signatures

| Prepared & Submitted By: | Conforme & Accepted By: |
| :--- | :--- |
| <br><br>___________________________________<br>**PROJECT LEAD / SOLUTION PROVIDER**<br>Paleng-Click Connect | <br><br>___________________________________<br>**AUTHORIZED MUNICIPAL OFFICIAL**<br>Municipal Government / LGU |
