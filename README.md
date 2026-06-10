# Auto Mailer Pro 🚀

Auto Mailer Pro is a high-performance,enterprise-grade AI-powered email marketing and campaign distribution suite. It features a fully-typed, robust monorepo architecture leveraging **TanStack Start** (SSR/SPA framework) on the frontend and a **Node.js + Express + TypeScript** server on the backend, integrated with **Supabase** for database management and authentication, and **Groq Cloud API** for smart lead segmentation and content generation.

---

## 📌 Table of Contents

- [Core Features](#-core-features)
- [Frontend UI/UX](#-frontend-uiux)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Directory Structure](#-directory-structure)
- [Environment Variables Configuration](#-environment-variables-configuration)
- [Getting Started & Installation](#-getting-started--installation)
- [Database Schema & Roles](#-database-schema--roles)
- [Deployment](#-deployment)
- [License](#-license)

---

## 🌟 Core Features

### 👤 Role-Based Access Control (RBAC)

The application has three tailored dashboards depending on user permissions:

- **Super Admin**: Platform-wide monitoring. Manage admin accounts, activate/suspend client organizations, and inspect system-wide transaction and usage statistics.
- **Admin**: Organization-level control. Upload CSV lead lists, set up SMTP server configurations, create and manage Sender accounts, segment leads using AI, and assign cohorts to specific Senders.
- **Sender**: Direct outreach operators. View assigned lists and cohorts, use generative AI tools to compose/humanize emails, generate subject line ideas, run campaigns, and track real-time delivery logs.

### 🧠 AI-Powered Campaign Tools

- **Smart Segmentation**: Automatically clusters lead lists (uploaded via CSV) into distinct target audiences using the Groq API.
- **Contextual Copywriting**: Generates highly personalized outreach drafts utilizing customizable prompts combined with lead fields (e.g., `{name}`, `{company}`).
- **Tone Humanizer**: Polishes generated drafts into natural, human-sounding outreach emails.
- **Subject Line Suggestions**: Recommends high-converting subject lines based on the body copy of the email.

### ✉️ Safe & Scalable Email Distribution

- **Decentralized SMTP Configuration**: Admins configure their own SMTP transport (e.g., Google App Passwords) stored using modern encryption (`AES-256-CBC`) at rest.
- **Recipient De-duplication**: Automatically avoids sending duplicate emails to the same recipient within the same campaign, preserving sender domain reputation.
- **Audit Logging**: Every single delivery attempt is captured in real-time logs, including recipient details, statuses (delivered, bounced, pending), and timestamps.

---

## 🎨 Frontend UI/UX

The frontend features a modern, visually appealing design with smooth animations and enhanced user experience.

### Key Features

- **Landing Page**: New dynamic landing page with animated backgrounds, floating stats, and colorful feature cards
- **Enhanced Components**: All core components (StatCard, Sidebar, Topbar) have been redesigned with gradients, shadows, and hover effects
- **Loading States**: Custom skeleton loaders for all data-fetching components
- **Empty States**: Reusable empty state components with icons and helpful messaging
- **Animations**: Custom animation wrappers (FadeIn, SlideIn, ScaleIn) for smooth transitions
- **Dark Mode**: Built-in theme toggle for dark/light mode switching

### Design System

- **Color Palette**: Gradient backgrounds, primary accent colors, muted secondary colors
- **Typography**: Bold headings with tight tracking, relaxed body text
- **Spacing**: Consistent padding and margins (p-6, py-24, gap-4 to gap-8)
- **Shadows**: Primary shadows (`shadow-primary/25`), card shadows, hover shadows
- **Borders**: Semi-transparent borders with opacity variations
- **Animations**: Pulse, bounce, spin, and custom slide/fade animations

### Component Library

- **Layout Components**: DashboardShell, Sidebar, Topbar
- **UI Components**: 46 shadcn/ui components (Button, Card, Table, Badge, etc.)
- **Custom Components**: StatCard (enhanced), loading skeletons, empty states, animation wrappers

### Responsive Design

- Mobile-first approach with breakpoints at md (768px) and lg (1024px)
- Sidebar hidden on mobile, visible on desktop
- Grid layouts adapt from 1 to 4 columns
- Tables have horizontal scroll on mobile

For detailed frontend documentation, see [parthiv-frontend.readme](./parthiv-frontend.readme).

---

## 💻 Architecture & Tech Stack

### Frontend

- **Framework**: [TanStack Start](https://tanstack.com/router/v1/docs/start/overview) (Server-side rendering, type-safe API, hydration & routing)
- **Router**: [TanStack Router](https://tanstack.com/router) (100% type-safe pathing & state management)
- **State & Queries**: [TanStack Query](https://tanstack.com/query) (React Query for asynchronous state synchronization)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) (Next-gen utility framework)
- **UI Components**: Radix UI primitives & Shadcn UI design patterns (46 components)
- **Icons**: Lucide React
- **Animations**: Custom animation wrappers with TailwindCSS (FadeIn, SlideIn, ScaleIn)
- **Loading States**: Custom skeleton loaders for all data-fetching components
- **Empty States**: Reusable empty state components with icons
- **Charts**: Recharts (for analytics and statistics)

### Backend

- **Runtime & Server**: Node.js & Express (written in pure TypeScript with `tsx` runner)
- **Database & Auth**: [Supabase](https://supabase.com/) (Auth, PostgreSQL database, and storage integration)
- **AI Engine**: [Groq SDK](https://github.com/groq/groq-node) (Fast inference with LLaMA model family)
- **Mailing Engine**: [Nodemailer](https://nodemailer.com/) (Customizable SMTP transports)
- **Encryption**: Built-in crypto module for securing SMTP credentials at rest

---

## 📂 Directory Structure

```text
├── backend/                       # Node.js + Express API Backend
│   ├── src/
│   │   ├── config/                # Database and third-party API configurations
│   │   ├── middleware/            # JWT validation and RBAC checks
│   │   ├── routes/                # Auth, Super-Admin, Admin, Sender, and AI routers
│   │   ├── utils/                 # SMTP encryption helpers
│   │   └── index.ts               # Main server entrypoint
│   ├── tsconfig.json
│   └── package.json
│
├── src/                           # TanStack Start Frontend Application
│   ├── components/                # Reusable UI component library
│   │   ├── layout/                # Layout components (DashboardShell, Sidebar, Topbar)
│   │   ├── ui/                    # Shadcn UI components (46 components)
│   │   │   ├── loading-skeleton.tsx    # Custom skeleton loaders
│   │   │   ├── empty-state.tsx         # Empty state components
│   │   │   └── animated-wrapper.tsx   # Animation wrappers
│   │   └── StatCard.tsx           # Enhanced stat card component
│   ├── hooks/                     # Custom React hooks (theme, query interfaces)
│   ├── lib/                       # Utility configurations (Supabase client, authentication state, theme contexts)
│   ├── routes/                    # File-based type-safe routes
│   │   ├── landing.tsx            # Landing page with modern design
│   │   ├── login.tsx              # Login page
│   │   ├── _authenticated/         # Protected routes (Admin, Sender, Super-Admin)
│   │   └── index.tsx              # Root route (redirects based on auth)
│   ├── services/                  # Network layer client (PlatformAPI, AdminAPI, SenderAPI)
│   ├── styles.css                 # Global CSS styles with Tailwind CSS directives
│   └── entrypoints/               # Server/client execution hooks (server.ts, start.ts, router.tsx)
│
├── parthiv-frontend.readme       # Detailed frontend documentation
├── wrangler.jsonc                 # Cloudflare Pages / Workers hosting configuration
├── package.json                   # Main workspace dependencies and workspace-wide command scripts
└── tsconfig.json                  # Global TypeScript configurations
```

---

## 🔑 Environment Variables Configuration

To run Auto Mailer Pro, both the frontend and backend require specific environment variables to be set up.

### Frontend Configurations

Create a `.env` or `.env.local` file in the root of the project:

```env
# URL where your Express backend server is running (defaults to http://localhost:4000)
VITE_API_BASE_URL=http://localhost:4000
```

### Backend Configurations

Create a `.env` file in the `backend/` directory:

```env
# Express Port
PORT=4000

# Supabase Credentials (from your Supabase Dashboard -> Settings -> API)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Groq Cloud API Key (from https://console.groq.com)
GROQ_API_KEY=your-groq-api-key

# Secret key used to encrypt SMTP App Passwords (must be a 32-character hexadecimal string)
SMTP_ENCRYPTION_SECRET=your-32-char-hex-encryption-key
```

---

## 🚀 Getting Started & Installation

### Prerequisites

- Node.js (version 18+ recommended)
- npm, yarn, pnpm, or bun

### Step 1: Install Dependencies

Install all dependencies in both the root workspace (frontend) and the backend directory:

```bash
# Install frontend and workspace dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### Step 2: Set Up Environments

Follow the steps in [Environment Variables Configuration](#-environment-variables-configuration) to populate `.env` files in both the root and `backend/` directories.

### Step 3: Run the Development Servers

We have packaged convenient scripts inside the root `package.json` to spin up either the frontend, backend, or both concurrently:

- **Run both frontend & backend concurrently (Recommended)**:
  ```bash
  npm run dev:all
  ```
- **Run frontend only**:
  ```bash
  npm run dev
  ```
- **Run backend only**:
  ```bash
  npm run dev:backend
  ```

Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 🗄️ Database Schema & Roles

For complete functionality, ensure your Supabase database includes a table called `profiles` mapped to `auth.users`. A sample schema overview is shown below:

### `profiles` Table

Stores custom user profiles tied to Supabase Authentication.

- `id` (uuid, primary key references `auth.users.id`)
- `email` (text, unique)
- `name` (text)
- `role` (text: `'super_admin' | 'admin' | 'sender'`)
- `smtp_configured` (boolean, indicates if SMTP credentials have been set up by the admin)

### Role-Based Route Mapping

- **Super Admin**: Redirected to `/super-admin` dashboard
- **Admin**: Redirected to `/admin` dashboard (or `/onboarding` if SMTP is not configured)
- **Sender**: Redirected to `/sender` dashboard

---

## 🌐 Deployment

### Frontend (Cloudflare Pages)

Auto Mailer Pro is pre-configured with a `@cloudflare/vite-plugin` and `wrangler.jsonc` configuration, making it optimized for **Cloudflare Pages**.

To build the frontend for production:

```bash
npm run build
```

To preview the build:

```bash
npm run preview
```

### Backend (Node.js Host)

To build and run the production Express API:

```bash
cd backend
npm run build
npm start
```

---

## 📄 License

This project is private and proprietary. All rights reserved.
