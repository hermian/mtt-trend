const path = require("path");

const ROOT = __dirname;

module.exports = {
  apps: [
    {
      name: "mtt-backend",
      script: path.join(ROOT, "scripts/pm2-mtt-backend.sh"),
      interpreter: "/bin/bash",
      cwd: path.join(ROOT, "backend"),
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "mtt-frontend",
      script: path.join(ROOT, "scripts/pm2-mtt-frontend.sh"),
      interpreter: "/bin/bash",
      cwd: path.join(ROOT, "frontend"),
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
  ],
};
