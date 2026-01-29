# Development Guide

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## Project Structure

```
importer-taobao-frontend/
├── app/                      # Next.js App Router
│   ├── page.tsx             # Login page (Client Component)
│   ├── layout.tsx           # Root layout
│   └── globals.css          # Global styles
├── lib/                      # Utility libraries
│   └── api/                 # API services
│       ├── auth.ts          # Authentication service
│       └── config.ts        # API configuration
├── types/                    # TypeScript definitions
│   └── auth.ts              # Auth types
└── components/              # React components (for future use)
```

## Environment Configuration

Two environments are pre-configured:
- **KC Staging**: `https://kcstaging.mitimiti.com`
- **KC Production**: `https://kcpro.mitimiti.com`

To add more environments, edit `lib/api/config.ts`.

## Authentication Flow

1. User selects environment
2. User enters credentials (username & password)
3. App calls `POST /rest/V1/integration/admin/token`
4. On success, token is stored in localStorage
5. Token can be used for subsequent API calls

## API Integration

### Authentication Endpoint
```
POST {baseUrl}/rest/V1/integration/admin/token
Content-Type: application/json

{
  "username": "admin_username",
  "password": "admin_password"
}

Response: "token_string"
```

## Adding New Features

### Adding a New Page
1. Create a new file in `app/` directory
2. Export a default React component
3. Use `'use client'` directive if client-side features needed

### Adding a New API Service
1. Create a new file in `lib/api/`
2. Export a class or functions for the service
3. Add types to `types/` directory
4. Update `lib/api/config.ts` with new endpoints

## Technologies Used

- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript 5** - Type safety
- **Tailwind CSS 4** - Utility-first CSS
- **Axios** - HTTP client for API calls

## Best Practices

1. **Security**: Never display tokens in the UI
2. **Error Handling**: Always provide user-friendly error messages
3. **TypeScript**: Use proper typing for all functions and components
4. **Styling**: Use Tailwind CSS classes consistently
5. **Components**: Keep components small and focused

## Common Issues

### Build Errors
- If fonts fail to load, ensure network access to Google Fonts or use system fonts
- Check that all imports are correct

### CORS Issues
- The API must allow requests from your domain
- Check CORS configuration on the server

### Authentication Failures
- Verify the environment URL is correct
- Ensure credentials are valid
- Check network connectivity

## Next Steps

Future enhancements could include:
- Product import page
- Product listing and management
- Category management
- Image upload and management
- Bulk import features
- Export functionality
- User management
- Dashboard with statistics
