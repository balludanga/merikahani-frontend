# लेखनी (Lekhani) — Frontend

Frontend for **Lekhani (लेखनी)** — a home for Hindi writers. कहानी, कविता, निबंध और संस्मरण — सब मानवीय लेखन, बिना किसी कृत्रिम लेखन सहायता के।

Built with React (Create React App) + React Router.

## Features

- Feed tabs: आपके लिए / फ़ॉलोइंग / विषय
- Long-form editor with Devanagari-first typography (title, subtitle, cover image, up to 5 tags)
- Claps (👏 up to 50 per reader)
- Responses (comments)
- Follow writers + followers/following counts on profiles
- Bookmarks → पढ़ने की सूची (reading list)
- Tags: browse by tag, popular tags
- Search across title, subtitle and content
- SEO: meta tags, Open Graph, JSON-LD, sitemap + RSS from the backend
- Listen (सुनें): browser text-to-speech for posts

## Getting Started

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd lekhani-frontend
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure the API URL** (optional — defaults to `http://localhost:8000/api`):

   ```bash
   cp .env.example .env.local
   ```

4. **Run the application:**

   ```bash
   npm start
   ```

   Run the backend (`merikahani-backend` repo) in parallel — the frontend talks to it at `/api`.

## Project Structure

- `public/index.html` — entry HTML with SEO meta + fonts
- `src/components/` — Navbar, StoryCard
- `src/pages/` — Home (landing + feed), Login, Editor, PostView, UserProfile, Stories (my posts), Search, Bookmarks
- `src/services/api.js` — axios API client (auth, posts, comments, users, follows, bookmarks, tags)
- `src/context/AuthContext.jsx` — auth state (email + Google sign-in)
- `src/utils/` — seo, format, ssmlTTS (Listen), analytics

## Scripts

- `npm start` — development server
- `npm run build` — production build
- `npm test` — test runner

## Deployment

Deployed on Vercel (`vercel.json` proxies `/api/*` to the Render backend). See `vercel.json` for the backend URL used in production.

## Contributing

If you would like to contribute to this project, please fork the repository and submit a pull request with your changes.
