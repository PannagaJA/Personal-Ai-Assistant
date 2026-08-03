# Your Personal AI

Personal AI Operating System (Jarvis) - Master Development Prompt

You are a Senior Staff Software Engineer, AI Architect, Product Designer, and Full Stack Developer.

Your objective is to build a production-quality Personal AI Operating System (Personal AI Assistant) for one single user only.

This is NOT a SaaS application.

This is NOT multi-tenant.

This is NOT a CRM.

It is my personal digital assistant that helps me manage my life, work, meetings, reminders, documents, emails, and knowledge.

The application should feel like "Jarvis" from Iron Man.

Primary Goal

Create a beautiful, modern, installable Progressive Web App (PWA) that can:

Understand natural language

Remember everything

Connect to my Google Account

Track my work

Suggest priorities

Search my documents

Manage reminders

Help me complete tasks

Learn from previous conversations

The assistant should be proactive instead of reactive.

Technology Stack

Frontend

React

Vite

TypeScript

TailwindCSS

React Router

TanStack Query

Zustand

shadcn/ui

Framer Motion

PWA

Installable

Offline support

Service Worker

Manifest

Push Notifications

Backend

Supabase Edge Functions

Database

Supabase PostgreSQL

Storage

Supabase Storage

Authentication

Google OAuth

AI

Gemini API

Notifications

Firebase Cloud Messaging

Hosting

Frontend → Vercel

Backend → Supabase

Storage → Supabase Storage

UI Theme

Create a premium modern interface similar to:

Linear

Notion

Arc Browser

ChatGPT

Apple

Google Material 3

Requirements

Dark Mode

Light Mode

Smooth animations

Rounded cards

Glassmorphism where appropriate

Mobile First

Desktop optimized

Authentication

Only one user.

Login only using Google.

After login the application should securely access:

Google Calendar

Gmail

Google Drive

Google Tasks

Google Contacts

Dashboard

Create an intelligent dashboard.

Sections

Good Morning

Today's Meetings

Today's Tasks

Unread Emails

Upcoming Follow Ups

Recent Notes

AI Suggestions

Quick Actions

Recent Documents

Daily Progress

The dashboard should automatically summarize my day.

AI Chat

Create a ChatGPT-like interface.

The assistant should understand commands such as:

"Schedule a meeting tomorrow."

"Remind me to call Smart Path."

"What meetings do I have today?"

"Show unread important emails."

"Find my ERP proposal."

"What did I discuss with Smart Path?"

"Summarize yesterday."

"What should I work on today?"

The AI should automatically call the correct tool.

Google Calendar

Integrate Google Calendar API.

Features

Read events

Create events

Edit events

Delete events

Today's schedule

Weekly schedule

Upcoming meetings

Natural language scheduling

Gmail

Integrate Gmail API.

Features

Read emails

Unread emails

Important emails

Search emails

Draft replies

Summarize inbox

Categorize emails

AI generated replies

Google Drive

Integrate Drive API.

Features

Search files

Open documents

Recent documents

Upload files

Read PDFs

Search inside documents

Google Tasks

Integrate Google Tasks.

Features

Read tasks

Create tasks

Update tasks

Complete tasks

Recurring tasks

Priority tasks

Google Contacts

Integrate People API.

Features

Search contacts

Quick call

Quick email

Recent contacts

Notes

Create an internal notes system.

Features

Rich text

Tags

Categories

Search

Pin notes

Archive

AI search

Voice notes

Follow Ups

Create a CRM-style follow-up system.

Fields

Title

Person

Company

Date

Priority

Status

Notes

Reminder

AI Suggestions

Recurring follow-ups

Documents

Allow uploads of

PDF

DOCX

Images

Screenshots

Voice Notes

Categorize automatically.

Allow AI search.

Memory

The assistant must remember:

Meetings

Clients

Ideas

Conversations

Projects

Decisions

Promises

Important facts

Every important conversation should automatically generate a structured memory.

The assistant should use these memories to answer future questions.

AI Suggestions

Every morning generate:

Today's meetings

Today's priorities

Pending work

Follow ups

Unread emails

Suggested schedule

Risk alerts

Deadlines

Notifications

Push notifications for:

Meetings

Tasks

Follow Ups

Deadlines

Custom reminders

Search

Create one universal search.

Search across

Notes

Tasks

Emails

Documents

Calendar

Follow Ups

Contacts

Chat history

Voice

Support

Speech to Text

Text to Speech

Voice commands

Chat History

Store conversations.

Allow searching previous conversations.

Settings

Dark Mode

Notification Settings

AI Preferences

Google Connections

Storage Usage

Export Data

Folder Structure

Create a scalable project structure with:

components/

pages/

hooks/

services/

lib/

types/

utils/

api/

auth/

calendar/

gmail/

drive/

tasks/

contacts/

notes/

memory/

documents/

followups/

notifications/

chat/

settings/

Code Quality

Requirements

TypeScript everywhere

Reusable components

Clean Architecture

SOLID principles

Strict typing

Responsive UI

Accessibility

Error boundaries

Loading states

Empty states

Skeleton loaders

Toast notifications

Optimistic updates

Modular APIs

Proper folder organization

No duplicate code

Future Ready

Design the application so future integrations can be added easily.

Examples

GitHub

WhatsApp

Slack

Discord

Spotify

Weather

Finance

Health

IoT

Every integration should be implemented as an independent tool or module.

Final Goal

The final product should feel like a true Personal AI Operating System.

When I open the application, it should know:

What I need to do today

What meetings I have

Which emails require attention

Which follow-ups are pending

What documents I need

What I discussed previously

What I should prioritize next

The application should proactively help me manage my work and life instead of waiting for commands.

Generate production-ready code with clean architecture, modern UI/UX, comprehensive documentation, and a scalable project structure. Build the application incrementally with working features rather than placeholders, ensuring every module is fully integrated before moving to the next.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://pannaga.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b457998d-1b10-45c5-9399-bf5bd02ed7a4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
