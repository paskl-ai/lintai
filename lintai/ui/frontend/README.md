# LintAI Frontend

This is the frontend web interface for the LintAI project. It is built with React, TypeScript, Vite, and Redux Toolkit. The UI provides visualizations (including Cytoscape graphs), configuration panels, and dashboards to interact with AI scan results and system components.

---

## 📦 Tech Stack

- **React** with TypeScript
- **Vite** for fast builds
- **Redux Toolkit** for state management
- **React Router** for routing
- **TailwindCSS** for styling
- **Cytoscape.js** for graph visualizations
- **MSW (Mock Service Worker)** for local API mocking
- **Vitest** for unit testing

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed on your system:

1. **Node.js**: Version 20 or higher.
   Install it from the [Node.js official website](https://nodejs.org/) or via a package manager:

   ```bash
   # macOS (Homebrew)
   brew install node
   ```

2. **Yarn**: A package manager for JavaScript.
   Install it globally if not already installed:

   ```bash
   npm install -g yarn
   ```

3. **Vite**: A fast build tool for modern web apps.
   Install it globally (optional, as Vite is already included as a dev dependency):

   ```bash
   npm install -g vite
   ```

4. **Git**: Ensure Git is installed on your system for version control.

---

### Install Dependencies

Navigate to the project directory and install the required dependencies:

```bash
cd lintai/ui/frontend
yarn install
```

---

### Build for Production

To build the frontend for production deployment:

```bash
yarn build
```

The built files will be available in the `dist/` directory.

---

### Run the UI Locally

You can start both the backend and frontend via the `lintai` CLI tool:

```bash
lintai ui [--port <port-number>]
```

The UI will be available at `http://localhost:8501` by default.

---

### Run Tests

To run unit tests for the project:

```bash
yarn test
```

---

## 🗂 Project Structure

```plaintext
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
```

---

## 🧪 Mock API (MSW)

The project uses **Mock Service Worker (MSW)** to simulate API responses during development and testing. It intercepts requests made by the frontend and returns mock data.

- MSW is automatically enabled in development environments (`yarn dev`).
- To modify mocked responses, edit the files in `src/mocks/`.

---

## 🛠 Troubleshooting

### Common Issues

1. **`yarn: command not found`**:
   - Ensure Yarn is installed globally:

     ```bash
     npm install -g yarn
     ```

2. **Outdated Dependencies**:
   - If you encounter warnings, try updating dependencies:

     ```bash
     yarn upgrade
     ```

3. **Port Conflicts**:
   - If the default port (`8501`) is in use, you can specify a different port:

     ```bash
     lintai ui --port 8502
     ```

---

## 📄 License

This project is licensed under the **Apache-2.0** license. See the `LICENSE` file for details.
