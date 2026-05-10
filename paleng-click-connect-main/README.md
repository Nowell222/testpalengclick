# PALENG-CLICK 🏪

**Paleng-Click Connect** is a comprehensive, modern web application designed for digital management of public markets (palengke). It streamlines the operational workflow between market administrators, cashiers, and vendors by providing dedicated portals for stall management, payment collections, and financial monitoring.

---

## 🌟 Key Features

### 🛡️ Admin Portal
- **User & Vendor Management**: Comprehensive tools to create, edit, and suspend users.
- **Bulk Import**: Effortlessly onboard hundreds of vendors via native CSV file uploading.
- **Stall & Section Management**: Assign stall numbers, define section locations, and manage multi-year billing rate schemas.
- **System Health**: Real-time KPI dashboards tracking active vendors, delinquent accounts, and total collected revenue.

### 💵 Cashier Portal
- **Offline-First Capabilities**: Continue collecting payments even without an internet connection using IndexedDB synchronization.
- **Receipt Generation**: Automatically generate and print professional PDF receipts for vendors upon successful payment.
- **Shift Reporting**: Generate end-of-day collection reports and export logs to CSV.

### 🏪 Vendor Dashboard
- **Financial Transparency**: Vendors can view their statements of account, outstanding balances, and historical payments.
- **QR Code Integration**: Generate secure QR codes for quick, contactless stall payments at the cashier.
- **Interactive UI**: A dynamic, premium user interface utilizing Framer Motion carousels for easy navigation of business metrics.

---

## 🛠️ Technology Stack

Paleng-Click is built on a modern, high-performance web stack:

### **Frontend**
- **Framework**: [React 18](https://react.dev/) with [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Routing**: [React Router v6](https://reactrouter.com/)
- **State Management**: [TanStack React Query](https://tanstack.com/query/latest)
- **Offline Storage**: [idb](https://www.npmjs.com/package/idb) (IndexedDB) & Vite PWA Plugin

### **UI & Styling**
- **CSS Framework**: [Tailwind CSS](https://tailwindcss.com/)
- **Component Library**: [Radix UI](https://www.radix-ui.com/) (via shadcn/ui)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Toast Notifications**: [Sonner](https://sonner.emilkowal.ski/)

### **Backend & Database**
- **BaaS**: [Supabase](https://supabase.com/) (PostgreSQL Database, Authentication, Storage, Edge Functions)

### **Utilities**
- **PDF Generation**: [jsPDF](https://github.com/parallax/jsPDF) & [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable)
- **Date Formatting**: [date-fns](https://date-fns.org/)
- **Data Validation**: [Zod](https://zod.dev/)

---

## ⚖️ Open Source Licenses & Legal

Paleng-Click utilizes various open-source libraries to deliver a seamless experience. 

**This software is completely safe for commercial use.** 
We do not use any proprietary third-party libraries for critical components (like CSV uploading, which is built natively using HTML5 `FileReader`).

The majority of our dependencies are licensed under the **MIT License**. A full distribution copy of the MIT License applying to these third-party libraries (including React, Vite, Tailwind CSS, Radix UI, jsPDF, and Supabase Client) is included in the project distribution under `public/oss-licenses.txt`.

---

## 🚀 Local Development Setup

To run this project locally, ensure you have [Node.js](https://nodejs.org/) (v18+) installed.

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd paleng-click-connect-main
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env.local` file in the root directory and add your Supabase keys:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Build for production:**
   ```bash
   npm run build
   ```

---

## 📁 Project Structure Overview

```text
├── public/                 # Static assets and open-source licenses (oss-licenses.txt)
├── src/
│   ├── components/         # Reusable UI components (buttons, inputs, layouts)
│   ├── integrations/       # Backend integrations (Supabase client setup)
│   ├── pages/              # Main route views (Admin, Cashier, Vendor pages)
│   └── main.tsx            # Application entry point
├── supabase/               # Supabase edge functions and configurations
├── tailwind.config.ts      # Tailwind CSS theme configuration
└── vite.config.ts          # Vite bundler and PWA configuration
```

---
*Built for modern municipal market management.*
