# 🪲 Beetle: Your AI-Powered Browser Companion

Beetle is a state-of-the-art, AI-driven browser extension designed to enhance your web browsing experience. It combines advanced Large Language Models (LLMs) with browser automation, content analysis, and context-aware interactions to provide a seamless digital assistant directly in your sidebar.

## 🚀 Key Features

-   **🧠 Context-Aware AI Chat**: Engage in intelligent conversations about the current page content. Beetle understands the DOM, extracting clean text and structure to provide accurate answers.
-   **🎥 YouTube Intelligence**: Automatically transcribes and analyzes YouTube videos, allowing you to ask questions about video content without watching the whole thing.
-   **📸 Smart Snapshotting**: Capture web pages in multiple formats, including PDF, Markdown, and even research paper styles, powered by specialized AI chains.
-   **🤖 Browser Automation**: An agentic loop that can perform actions on your behalf, navigating and interacting with web elements based on your goals.
-   **📝 AI-Powered Note Taking**: Save snippets, summaries, and video insights directly into a persistent note-taking system.
-   **🔍 Vector Search**: Uses ChromaDB and OpenAI Embeddings to store and retrieve your browsing history and saved context efficiently.

## 🛠️ Tech Stack

### Backend (`/api`)
-   **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python)
-   **AI Orchestration**: [LangChain](https://www.langchain.com/) & [LangGraph](https://www.langchain.com/langgraph)
-   **Database**: [SQLAlchemy](https://www.sqlalchemy.org/) (PostgreSQL/SQLite) & [ChromaDB](https://www.trychroma.com/) (Vector Store)
-   **Embeddings**: OpenAI `text-embedding-3-small`
-   **Processing**: BeautifulSoup4 for HTML parsing, PyTesseract/OCR capabilities.

### Frontend (`/extension-v2`)
-   **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
-   **Icons**: [Lucide React](https://lucide.dev/)
-   **State Management**: React Hooks & Context API

## 📂 Project Structure

```text
.
├── api/                # FastAPI Backend
│   ├── db/             # Database Models & Migrations
│   ├── utils/          # Vector Store & Text Processing
│   ├── main.py         # Entry point & API Routes
│   └── runnable.py      # LangChain chains & Agent logic
├── extension-v2/       # React-based Browser Extension
│   ├── public/         # Manifest.json & Assets
│   └── src/            # Extension Components & Logic
└── extension-v1/       # Legacy Extension Version
```

## ⚙️ Getting Started

### Backend Setup
1. Navigate to the `api` directory.
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up your `.env` file with `OPENAI_API_KEY` and database credentials.
5. Run the server:
   ```bash
   uvicorn main:app --reload
   ```

### Extension Setup
1. Navigate to the `extension-v2` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
4. Open Chrome and navigate to `chrome://extensions/`.
5. Enable "Developer mode" and click "Load unpacked".
6. Select the `extension-v2/dist` folder.

## 📜 License
This project is private and intended for personal/internal use.
