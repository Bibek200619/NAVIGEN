# NAVIGEN — Frontend Web Application

The React frontend interface for the NAVIGEN UGV operator dashboard.

This project now lives at the canonical repository path:

```text
web_app/frontend/
```

## Tech Stack

- **React 19**
- **TypeScript**
- **Vite**
- **Tailwind CSS v4**
- **React Router v7**
- **Lucide React**
- **ESLint**

## Getting Started

### Prerequisites

- Node.js (>= 18)
- npm

### Installation

```bash
cd web_app/frontend
npm install
```

### Development Server

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Directory Structure

```text
web_app/frontend/
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── camera/
│   │   ├── common/
│   │   ├── dashboard/
│   │   ├── layout/
│   │   ├── mission/
│   │   ├── robot/
│   │   └── sensors/
│   ├── constants/
│   ├── hooks/
│   ├── pages/
│   │   ├── Camera/
│   │   ├── Dashboard/
│   │   ├── Logs/
│   │   ├── Mission/
│   │   ├── Robot/
│   │   ├── Sensors/
│   │   └── Settings/
│   ├── services/
│   ├── types/
│   ├── utils/
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── .env.example
├── .gitignore
├── eslint.config.js
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Shared contracts

Frontend field names and API/database mappings must follow the canonical documents in:

```text
web_app/docs/ARCHITECTURE.md
web_app/docs/DATABASE_SCHEMA.md
```

The frontend may use TypeScript `camelCase` domain models, but API/database payloads use the documented canonical `snake_case` names and must be converted through service/adapter boundaries rather than renamed ad hoc.
