# Wiki source

This folder contains the **source markdown for the GitHub wiki** of the `ads` repository.
GitHub wikis serve flat markdown pages; each file here maps to a wiki page.

## File → page mapping

| File | Wiki page |
|---|---|
| `Home.md` | Home (the wiki landing page) |
| `_Sidebar.md` | Sidebar (special page, shown on every page) |
| `_Footer.md` | Footer (special page, shown on every page) |
| `Getting-Started.md` | Getting Started |
| `Architecture.md` | Architecture |
| `Repository-Structure.md` | Repository Structure |
| `Packages-and-Engines.md` | Packages & Engines |
| `Production-Pipeline.md` | Production Pipeline |
| `CLI-Reference.md` | CLI Reference |
| `API-Reference.md` | API Reference |
| `Brand.md` | Brand |
| `Creative-System.md` | Creative System |
| `Contributing.md` | Contributing |
| `Roadmap.md` | Roadmap & Status |

## Publishing

GitHub wikis are a separate git repository. To publish these pages, clone the wiki
(`git clone https://github.com/<owner>/<repo>.wiki.git`), copy the `.md` files from this
folder into it, then commit and push. Alternatively, edit pages directly through the GitHub
web UI.

Keep internal links as bare page names (e.g. `[Architecture](Architecture)`) so they resolve
inside the wiki — not as relative file paths.
