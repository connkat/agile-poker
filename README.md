# ML Agile Poker DEMO

## Overview

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app) with [Supabase](https://supbase.com) as a hosted postgres DB. It is a free and simple app to facilitate agile poker for international teams without having to pay for a built-in widget. 

## Future Work
As this project is a V1, there are some known small bugs and UI issues. Future changes are tracked in [future-features.md](/future-features.md).

## Local Development

1. Fork and then clone the repo: `git clone git@github.com:<USERNAME>/agile-poker.git`

2. Install the packages (I am using npm but you can choose your own adventure): 

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

3. Setup A Supabase DB 
- Create an account and set up a new project. 
- Go to the `SQL editor` and copy/paste the SQL from the files found in the [setup folder](/setup/)
    - [DB-setup](/setup/RLS-setup.sql)
		- [RLS-setup](/setup/RLS-setup.sql)
    - [trigger-setup](/setup/trigger-setup.sql)
- Get the `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY` and add them to a .env file

4. Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Hosting
1. Login/Signup for Netlify using your Github account 
2. Set up a new project, and point it to `main` for this repo. 
3. Update the `environment variables` of your project to match what is in your .env file