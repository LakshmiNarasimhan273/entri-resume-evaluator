# Browser end-to-end check (needs: pip install playwright && playwright install chromium).
# Run:  npm run build && npx vite preview --port 4173   then in another terminal:  python3 tests/e2e/browser_flow.py
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1150,"height":950})
    pg.goto("http://localhost:4173/")
    pg.select_option("#course","FSD"); pg.wait_for_timeout(300); pg.select_option("#role","MERN Stack Developer")
    pg.set_input_files("input[type=file]","tests/e2e/sample_resume.pdf"); pg.fill("#learner","Pavithra")
    pg.click("text=Evaluate Resume"); pg.wait_for_selector("#results",timeout=120000); pg.wait_for_timeout(1200)
    print("SKILLS LINE:", pg.inner_text("#review-skills .rewrite-text"))
    print("\nPROJECT COPY-READY:\n", pg.inner_text("#review-projects .rewrite"))
    # sticky tab bar while scrolled into the cards
    pg.evaluate("document.querySelector('#review-projects').scrollIntoView()"); pg.wait_for_timeout(500)
    pg.screenshot(path="tests/e2e/shot_projects.png")
    pg.evaluate("window.scrollTo(0, document.body.scrollHeight)"); pg.wait_for_timeout(500)
    pg.screenshot(path="tests/e2e/shot_bottom.png")
    pg.click(".back-top"); pg.wait_for_timeout(1200); print("\nscrollY after Back to top:", pg.evaluate("window.scrollY"))
    pg.click(".tab:nth-child(2)")
    pg.fill(".jd-text","We are hiring a MERN Stack Developer to build responsive interfaces with React and TypeScript, create REST APIs with Node.js and Express, store data in MongoDB and deploy with Docker on AWS. Git and Jest knowledge is a plus.")
    pg.click("text=Match with Resume"); pg.wait_for_timeout(600)
    pg.evaluate("document.querySelector('#jobmatch').scrollIntoView()"); pg.wait_for_timeout(400)
    pg.screenshot(path="tests/e2e/shot_jd.png")
    b.close()
