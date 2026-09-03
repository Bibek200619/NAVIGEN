# NAVIGEN — Frontend Web Application

The web frontend interface for NAVIGEN UGV.

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
cd webapp
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
webapp/
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
