# DevTrack — Developer Habit & Streak Platform

**Build consistency. Track progress. Become a better developer.**

DevTrack is a mobile-first, full-stack habit tracking and personal growth platform designed to help developers build consistent coding routines, track daily goals, and visualize their progress over time.

From DSA practice and system design learning to project development and personal habits, DevTrack aims to turn long-term ambitions into measurable daily actions.

## ✨ Features

### Core Features
- **Daily Habit Tracking** — Organize and track recurring habits.
- **Streak Tracking** — Monitor consecutive habit completions.
- **Weekly Progress** — Visualize consistency and review weekly performance.
- **Developer-Focused Goals** — Track habits such as DSA practice, coding, and system design.
- **Mobile-First Interface** — Designed for a responsive experience across mobile and desktop.

*The feature list should reflect the functionality currently implemented in the repository. Mark planned features as upcoming until they are working.*

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL (Neon) |
| ORM | Prisma |
| Testing | Vitest, Supertest |

## 🏗️ Project Architecture

```text
devtrack/
├── backend/
│   ├── src/
│   │   ├── config/        # Configuration and environment validation
│   │   ├── controllers/   # HTTP request and response handling
│   │   ├── routes/        # API route definitions
│   │   ├── services/      # Business logic and streak calculations
│   │   ├── middlewares/   # Express middleware
│   │   ├── app.ts         # Express application setup
│   │   └── server.ts      # Server entry point
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/           # Backend API client
│   │   ├── components/    # Reusable UI components
│   │   ├── features/      # Habit tracking and streak features
│   │   ├── hooks/         # Custom React hooks
│   │   ├── layouts/       # Responsive layout components
│   │   └── App.tsx         # Root React component
│   └── package.json
│
├── .gitignore
└── README.md
```

*The directory tree is illustrative; update it to match the actual repository as the project evolves.*

## ⚙️ Getting Started

### Prerequisites

Install the following before running the application:

- [Node.js](https://nodejs.org/) — use a supported LTS release.
- npm — included with Node.js.
- A PostgreSQL database, such as [Neon](https://neon.tech/).
- Git.

### 1. Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd devtrack
```

Replace the placeholder with your actual GitHub repository URL.

### 2. Configure the Backend

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory using the environment variables required by your application.

For example, if your configuration uses these names:

```env
PORT=5000
DATABASE_URL="your_postgresql_connection_string"
NODE_ENV=development
```

Use your actual environment-variable names and validation rules. Add any other required variables documented by your implementation.

**Security:** Never commit `.env` files, database credentials, or other secrets to GitHub.

### 3. Set Up the Database

If your project uses Prisma migrations, run the commands supported by your installed Prisma version and project configuration.

For a typical Prisma project:

```bash
npx prisma generate
npx prisma migrate dev
```

Ensure your PostgreSQL database is accessible and `DATABASE_URL` is correctly configured before running migrations.

### 4. Start the Backend

Use the development script defined in `backend/package.json`. For example, if it is named `dev`:

```bash
npm run dev
```

The API will typically be available at `http://localhost:5000`, depending on your configuration.

### 5. Start the Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Vite typically serves the frontend at `http://localhost:5173`.

Configure the frontend API base URL to point to your local backend, using the environment-variable name expected by your API client.

## 🧪 Testing

DevTrack uses Vitest and Supertest for automated testing.

Run the test scripts configured in each package's `package.json`. For example, if both packages define a `test` script:

```bash
cd backend
npm test
```

In another terminal:

```bash
cd frontend
npm test
```

Test coverage should include habit creation, completion records, duplicate submissions, streak calculations, and relevant API error cases as those features are implemented.

## 🔐 Security and Reliability

The project aims to follow good engineering practices, including:

- Server-side request validation.
- Secure handling of environment variables.
- User-level authorization for personal data.
- Reliable database constraints and migrations.
- Automated regression testing.
- Consistent error handling.

Document security features as implemented only after they have been verified.

## 🗺️ Roadmap

- [ ] Complete the core habit-tracking workflow.
- [ ] Implement and test accurate streak calculations.
- [ ] Add weekly and monthly progress analytics.
- [ ] Complete authentication and user-specific data access.
- [ ] Expand automated test coverage.
- [ ] Add Docker-based local development.
- [ ] Set up CI checks and production deployment.
- [ ] Improve installable mobile-web support.
- [ ] Explore a React Native mobile application.

## 🎯 Project Goals

DevTrack is being developed to explore practical full-stack engineering concepts:

- REST API design and modular backend architecture.
- Relational database modeling and data integrity.
- Reusable frontend components and responsive UI design.
- Testing business logic and API behavior.
- Secure application development and deployment.

## 🤝 Contributing

Suggestions, bug reports, and improvements are welcome. If contributing, please describe the proposed change, explain its purpose, and include relevant tests.

## 📄 License

A license has not yet been specified. Add a `LICENSE` file and update this section before allowing others to reuse or redistribute the project.

---

**DevTrack — Small daily actions. Measurable long-term growth.**