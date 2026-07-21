This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
./scripts/local-frontend.sh
```

The launcher checks whether ports **3000** (default) and **3001**
(fallback) are already in use before starting Next.js. For each
occupied port it prints the PID, process name, cmdline, and cwd
(when readable) so you can see what to stop. It never auto-kills a
process it does not recognise, and it refuses to jump to port
**3010** (that port belongs to another project). If both 3000 and
3001 are taken, the launcher exits with an error rather than
silently picking a third port.

You can still run `npm run dev` directly if you want to bypass the
preflight; the launcher is just `PORT=<free_port> npm run dev`
with the port-conflict report in front of it.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. If the launcher fell back to 3001, open [http://localhost:3001](http://localhost:3001) instead.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Local Validation

Run the same static checks used by frontend CI:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Frontend CI is static/build-only. It sets `NEXT_PUBLIC_BACKEND_URL` to `http://127.0.0.1:8080` for a deterministic build, but it does not start or require the backend, does not require secrets, and does not use an admin token.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.




## ⚖️ License

This repository is part of the **deopt** ecosystem and is licensed under the **Business Source License 1.1** (BSL 1.1).

* **Non-Production & Educational use** is fully authorized.
* **Commercial & Production use** is strictly prohibited until **May 20, 2030**, after which the code will automatically transition to the **GNU General Public License v3.0 (GPL-3.0)**.