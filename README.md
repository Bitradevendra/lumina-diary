# Lumina Diary

A voice-aware, assistant-enhanced diary app that blends journaling, reminders, onboarding, and cloud-backed user flows into one polished personal writing experience.

## Why It Has Strong Product Energy

`lumina-diary` does not read like a basic notes app. It has identity. Between the guided onboarding, calendar-driven entry flow, voice interaction pieces, reminder support, Gemini features, and Firebase-backed state, it feels like a product trying to become a daily ritual.

## What It Does

- manages diary entries and reminders through a React app
- supports onboarding for Gemini API configuration
- integrates Firebase-backed auth and cloud data workflows
- includes voice-oriented UI pieces and calendar-based navigation

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

Create `.env.local` if needed:

```env
GEMINI_API_KEY=your_api_key_here
```

## Run Locally

```bash
npm run dev
```

Build and preview:

```bash
npm run build
npm run preview
```

## How It Works

- `App.tsx` coordinates authentication, diary entries, reminders, settings, and onboarding state.
- `components/` contains the editor, login, calendar, and API-key onboarding interfaces.
- `services/firebase.ts` handles cloud sync and user/session behavior.
- `services/geminiService.ts` powers the assistant-style writing features.
- `constants.tsx` and `types.ts` shape the application’s shared language and UI behavior.

## Why Someone Would Open This Repo

This is the kind of project that appeals to builders interested in personal software that feels guided, reflective, and a little more human than a generic CRUD app.
