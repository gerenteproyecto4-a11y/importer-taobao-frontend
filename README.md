# Taobao Product Importer - Frontend

A Next.js application for importing products from Taobao using the OtCommerce API.

## Features

- 🔐 Secure login with admin authentication
- 🌐 Multi-environment support (Staging & Production)
- 🎨 Modern UI with Tailwind CSS
- 🌙 Dark mode support
- ⚡ Built with Next.js 16 and React 19

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/ingenierosenior35-IR/importer-taobao-frontend.git
cd importer-taobao-frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Environment Configuration

The application supports two environments:

- **KC Staging**: `https://kcstaging.mitimiti.com`
- **KC Production**: `https://kcpro.mitimiti.com`

You can select the environment on the login screen.

## OTAPI – Optimización de coste

Para reducir las llamadas de pago a la API OTAPI (categorías) se usa un árbol de categorías en una sola llamada; el listado de productos no tiene cache (cada petición llama a OTAPI).

## API Integration

The application integrates with the OtCommerce API for authentication:

- **Endpoint**: `/rest/V1/integration/admin/token`
- **Method**: POST
- **Body**:
```json
{
  "username": "admin_user",
  "password": "admin_pass"
}
```

## Project Structure

```
├── app/                  # Next.js app directory
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Login page
│   └── globals.css       # Global styles
├── lib/                  # Library code
│   └── api/              # API utilities
│       ├── auth.ts       # Authentication service
│       └── config.ts     # API configuration
├── types/                # TypeScript type definitions
│   └── auth.ts           # Auth-related types
└── components/           # React components (future use)
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Technologies Used

- **Next.js 16** - React framework
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **Axios** - HTTP client

## License

MIT

