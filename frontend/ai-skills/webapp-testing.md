\---

name: webapp-testing

description: Toolkit for interacting with and testing local web applications using Playwright. Supports verifying frontend functionality, debugging UI behavior, capturing browser screenshots, and viewing browser logs.

license: Complete terms in LICENSE.txt

\---



\# Web Application Testing



To test local web applications, write native Python Playwright scripts.



\*\*Helper Scripts Available\*\*:

\- `scripts/with\_server.py` - Manages server lifecycle (supports multiple servers)



\*\*Always run scripts with `--help` first\*\* to see usage. DO NOT read the source until you try running the script first and find that a customized solution is abslutely necessary. These scripts can be very large and thus pollute your context window. They exist to be called directly as black-box scripts rather than ingested into your context window.



\## Decision Tree: Choosing Your Approach



```

User task → Is it static HTML?

&#x20;   ├─ Yes → Read HTML file directly to identify selectors

&#x20;   │         ├─ Success → Write Playwright script using selectors

&#x20;   │         └─ Fails/Incomplete → Treat as dynamic (below)

&#x20;   │

&#x20;   └─ No (dynamic webapp) → Is the server already running?

&#x20;       ├─ No → Run: python scripts/with\_server.py --help

&#x20;       │        Then use the helper + write simplified Playwright script

&#x20;       │

&#x20;       └─ Yes → Reconnaissance-then-action:

&#x20;           1. Navigate and wait for networkidle

&#x20;           2. Take screenshot or inspect DOM

&#x20;           3. Identify selectors from rendered state

&#x20;           4. Execute actions with discovered selectors

```



\## Example: Using with\_server.py



To start a server, run `--help` first, then use the helper:



\*\*Single server:\*\*

```bash

python scripts/with\_server.py --server "npm run dev" --port 5173 -- python your\_automation.py

```



\*\*Multiple servers (e.g., backend + frontend):\*\*

```bash

python scripts/with\_server.py \\

&#x20; --server "cd backend \&\& python server.py" --port 3000 \\

&#x20; --server "cd frontend \&\& npm run dev" --port 5173 \\

&#x20; -- python your\_automation.py

```



To create an automation script, include only Playwright logic (servers are managed automatically):

```python

from playwright.sync\_api import sync\_playwright



with sync\_playwright() as p:

&#x20;   browser = p.chromium.launch(headless=True) # Always launch chromium in headless mode

&#x20;   page = browser.new\_page()

&#x20;   page.goto('http://localhost:5173') # Server already running and ready

&#x20;   page.wait\_for\_load\_state('networkidle') # CRITICAL: Wait for JS to execute

&#x20;   # ... your automation logic

&#x20;   browser.close()

```



\## Reconnaissance-Then-Action Pattern



1\. \*\*Inspect rendered DOM\*\*:

&#x20;  ```python

&#x20;  page.screenshot(path='/tmp/inspect.png', full\_page=True)

&#x20;  content = page.content()

&#x20;  page.locator('button').all()

&#x20;  ```



2\. \*\*Identify selectors\*\* from inspection results



3\. \*\*Execute actions\*\* using discovered selectors



\## Common Pitfall



❌ \*\*Don't\*\* inspect the DOM before waiting for `networkidle` on dynamic apps

✅ \*\*Do\*\* wait for `page.wait\_for\_load\_state('networkidle')` before inspection



\## Best Practices



\- \*\*Use bundled scripts as black boxes\*\* - To accomplish a task, consider whether one of the scripts available in `scripts/` can help. These scripts handle common, complex workflows reliably without cluttering the context window. Use `--help` to see usage, then invoke directly. 

\- Use `sync\_playwright()` for synchronous scripts

\- Always close the browser when done

\- Use descriptive selectors: `text=`, `role=`, CSS selectors, or IDs

\- Add appropriate waits: `page.wait\_for\_selector()` or `page.wait\_for\_timeout()`



\## Reference Files



\- \*\*examples/\*\* - Examples showing common patterns:

&#x20; - `element\_discovery.py` - Discovering buttons, links, and inputs on a page

&#x20; - `static\_html\_automation.py` - Using file:// URLs for local HTML

&#x20; - `console\_logging.py` - Capturing console logs during automation

