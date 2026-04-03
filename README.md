# lumina-diary

`lumina-diary` is a Vite and React diary application with Gemini-powered writing assistance and Firebase-backed user flows.

## Overview

The app combines diary entry management, calendar-style views, onboarding for API configuration, and service modules for Gemini and Firebase integration.

## Project Structure

```text
lumina-diary/
|-- App.tsx
|-- components/
|-- services/
|-- constants.tsx
|-- types.ts
|-- package.json
|-- vite.config.ts
|-- index.html
`-- README.md
```

## Requirements

- Node.js 18+
- npm
- a `GEMINI_API_KEY` in `.env.local`

## Installation

```bash
npm install
```

Create `.env.local` with your Gemini API key if needed:

```env
GEMINI_API_KEY=your_api_key_here
```

## Running The Project

Development server:

```bash
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## How It Works

- `App.tsx` coordinates authentication, diary state, onboarding, and editor flows
- `components/` contains the login, editor, calendar, and onboarding UI
- `services/geminiService.ts` provides Gemini-powered assistant features
- `services/firebase.ts` handles Firebase-related integration used by the app
- `constants.tsx` and `types.ts` define the shared app configuration and types
