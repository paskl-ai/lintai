# LintAI Frontend

This is the frontend web interface for the LintAI project. It is built with React, TypeScript, Vite, and Redux Toolkit. The UI provides visualizations (including Cytoscape graphs), configuration panels, and dashboards to interact with AI scan results and system components.

## 📦 Tech Stack

- **React** with TypeScript
- **Vite** for fast builds
- **Redux Toolkit** for state management
- **React Router** for routing
- **TailwindCSS** for styling
- **Cytoscape.js** for graph visualizations
- **MSW (Mock Service Worker)** for local API mocking
- **Vitest** for unit testing

## 🚀 Getting Started

### Prerequisites

- Node.js v20+
- Yarn (`npm install -g yarn`)

### Install Dependencies

```bash
cd lintai/ui/frontend
yarn install
````

### Build for Production

```bash
yarn build
```

### Run the UI

The backend server and frontend UI are started via the `lintai` CLI tool:

```bash
lintai ui [--port <port-number>]
```

### Run Tests

```bash
yarn test
```

## 🗂 Project Structure

src/
├── api/                # API service calls
├── components/         # Reusable UI components
├── features/           # Redux slices
├── pages/              # Page-level components
├── redux/services/     # Store setup & reducers
├── utils/              # Utility functions
├── layout/             # Layout wrappers
├── Router/             # Public & private routing
├── mocks/              # MSW handlers for testing
├── index.tsx           # App entry point

## 🧪 Mock API (MSW)

MSW (Mock Service Worker) is used to simulate API responses during development and testing. It is automatically enabled in development environments.
