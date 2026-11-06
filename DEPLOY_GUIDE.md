# cinebySB — free deployment guide (preview setup)

## Important before publishing
This starter currently saves movie files in `uploads/` and its catalogue in `data/movies.json`.
Render Free uses an ephemeral filesystem: uploads and catalogue changes can disappear after a restart,
spin-down, or redeploy. Therefore this deployment is for testing the site shell only. Do NOT upload
your permanent movie collection yet.

For durable public movie streaming, the app must be connected to persistent object storage (for example,
Cloudflare R2) and durable metadata storage before you publish real movies. R2's free monthly allowance
is limited (currently 10 GB-month of Standard storage); usage above the allowance can be billed.
Render Free services also sleep after 15 minutes of inactivity and can take about a minute to wake.

## 1. Create GitHub account
1. Open https://github.com/ and create a free personal account.
2. Verify your email address.
3. Keep your account password private. Do not share it with anyone.

## 2. Create a repository
1. Sign in to GitHub and choose **New repository**.
2. Repository name: `cinebySB`.
3. Choose **Public** (the source code contains no movie files or secrets; never commit `.env`).
4. Create the repository.
5. Extract this ZIP on a computer, open the `cinebySB` folder, and upload its CONTENTS to the repository root using **Add file → Upload files**.
   The repository root must contain `package.json`, `server.js`, `public/`, `data/`, `uploads/`, and `render.yaml` (not an extra nested `cinebySB/cinebySB/` folder).
6. Commit the uploaded files.

## 3. Deploy on Render
1. Open https://render.com/ and create a free account.
2. Choose **New → Web Service** and connect GitHub.
3. Select the `cinebySB` repository.
4. Render should detect `render.yaml`. If asked, use:
   - Runtime: Node
   - Build command: `npm install`
   - Start command: `npm start`
   - Instance type: Free
5. Add `ADMIN_PASSWORD` as a secret environment variable in Render. Use a long, unique password.
6. Keep the generated `JWT_SECRET`; never publish it.
7. Create the service and wait for the first deploy to finish.
8. Open the `onrender.com` URL shown on the service page.

## 4. Test only
- Open the site URL.
- Use **Admin login** and the `ADMIN_PASSWORD` you set.
- Test the page and admin interface without uploading valuable movie files.
- Free Render services sleep after 15 minutes of inactivity, so the first visit after idle may take about a minute.

## 5. Before uploading real movies
Stop here and connect durable media + catalogue storage. This starter's local `uploads/` and `data/movies.json` are not persistent on Render Free.
Do not put movie files, passwords, API tokens, or `.env` in GitHub.
Only upload films you own or are licensed to distribute.
