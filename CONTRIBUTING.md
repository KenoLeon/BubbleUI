# Contributing to Bubble UI

Thank you for your interest in contributing!  
Bubble UI is an experimental, evolving project exploring new patterns for local-first, context-rich AI chat interfaces.  
All contributions—bug reports, feature ideas, code, and documentation—are welcome.

---

## Contributing Task List

Below are areas where you can help improve Bubble UI.  
If you’re looking for a place to start, pick any unchecked item or suggest your own!

### Core Features & Improvements

- [ ] Modularize `index.js` (split into UI, storage, chat, and context modules)
- [ ] Add JSDoc comments to all functions and complex logic
- [ ] Refactor long functions (e.g., `renderChatHistory`) into smaller, focused helpers
- [ ] Remove any remaining dead code or unused variables
- [ ] Add autosave chat history option
- [ ] Migrate from localStorage to IndexedDB for larger data support
- [ ] Add better mobile support and/or a dedicated mobile design
- [ ] Add more robust error handling and user feedback (e.g., API key errors)
- [ ] Add an option to export/import chats and contexts
- [ ] Add support for multiple LLM providers (if desired)
- [ ] Add user settings/preferences panel

### Accessibility & UX

- [ ] Improve ARIA attributes and keyboard navigation
- [ ] Ensure color contrast meets WCAG standards (especially in dark mode)
- [ ] Add focus styles for all interactive elements

### Testing & CI

- [ ] Add basic unit tests (e.g., for storage, chat logic)
- [ ] Add a linter (ESLint) and a formatting tool (Prettier)
- [ ] Set up a GitHub Actions workflow for CI (lint, build, test)

### Documentation

- [ ] Expand the README.md with:
    - [ ] Screenshots/gifs of the UI
    - [ ] Full feature list and usage instructions
    - [ ] Keyboard shortcuts and accessibility notes
    - [ ] Tech stack and architecture overview
    - [ ] FAQ and troubleshooting
- [ ] Add a `CONTRIBUTING.md` with:
    - [ ] How to set up the project locally
    - [ ] Coding style guidelines
    - [ ] How to submit issues and pull requests
- [ ] Add a LICENSE file (MIT or similar)
- [ ] Add a CODE_OF_CONDUCT.md (optional, but good for open source)

### Performance

- [ ] Minify and optimize CSS/JS for production builds
- [ ] Lazy-load heavy dependencies (like highlight.js) if needed

### Community

- [ ] Add issue and PR templates
- [ ] Tag good first issues for new contributors
- [ ] Add a project board or roadmap

---

## How to Contribute

### 1. Reporting Bugs & Suggesting Features
- Use [GitHub Issues](https://github.com/KenoLeon/BubbleUI/issues) to report bugs or suggest features.
- Please include clear steps to reproduce bugs, screenshots if possible, and your environment (browser, OS).

### 2. Pull Requests
- Fork the repository and create your branch from `main`.
- Make your changes with clear, descriptive commit messages.
- If your change is experimental or a work-in-progress, mark the PR as a draft.
- For UI/UX changes, include screenshots or GIFs if possible.
- Ensure your code is readable and commented, as this project is also a portfolio piece.

### 3. Development Setup
```sh
git clone https://github.com/KenoLeon/BubbleUI.git
cd BubbleUI
npm install
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build & Deploy
- Build: `npm run build`
- Deploy (if you have access): `npm run deploy`

---

## Guidelines

- **Experimental Project:**  
  Some features and UI elements are experimental and may change or be replaced.  
  Not all controls are guaranteed to work perfectly—please help us improve them!
- **Code Style:**  
  Use clear, descriptive names and add comments for complex logic.
- **API Keys:**  
  Never commit real API keys. Use `src/apikey.js` (gitignored) for local testing.
- **Security:**  
  For production, use OAuth or a secure API proxy. This project is intended for local/demo use.
- **Accessibility & UX:**  
  Contributions to improve accessibility and mobile support are especially welcome.

---

## Roadmap & Good First Issues

See the [GitHub Issues](https://github.com/KenoLeon/BubbleUI/issues) for ideas and open tasks.  
Look for issues tagged `good first issue` if you’re new to the project.

---

## Community

- Be respectful and constructive in all interactions.
- See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) (if present) for more.

---

Thank you for helping make Bubble UI better!