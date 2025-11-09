Render-ready Encrypted Video Chat (Go-Live)
------------------------------------------

- Single Docker container that serves backend (Node.js + Socket.IO) and frontend static pages.
- Features:
  * Signup/Login (phone ID + password + admin key)
  * Public chat with Go-Live broadcaster (one broadcaster, many viewers)
  * Private rooms by entry key with P2P video
- NOTE: This demo uses an in-memory store for users. Data will not persist across restarts.
- To deploy on Render:
  1. Push this repo to GitHub.
  2. Create a new Web Service on Render, point to the repo, Docker runtime.
  3. Set environment variables: JWT_SECRET, ADMIN_KEY
  4. Deploy and open /signup.html to create accounts.
