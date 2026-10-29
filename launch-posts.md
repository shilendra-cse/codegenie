# Hobai launch posts

## LinkedIn

### 1. How it works

Today, Hobai is live at hobai.app 🚀

I built Hobai so a clear coding task can become a pull request without me doing the typing.

Here's how it works, end to end:

1️⃣ Connect GitHub. Install the Hobai GitHub App on just the repositories you choose.

2️⃣ Set up once. Hobai works out how to install and check your repo: package manager, lint, type-check, tests, build. If it can't decide, it asks you a few multiple-choice questions. Every step it keeps has actually run in a fresh sandbox.

3️⃣ Describe the task. For example: "Add a GET /health endpoint that returns 200 with the database status, and 503 when the database is down. Add tests."

4️⃣ Watch it work live. Every file it reads, every edit, every command and its output, inside its own isolated cloud sandbox.

5️⃣ Review the pull request. Hobai runs your checks before and after the change and puts the results in the PR, along with a summary and the changed files. Ready when the checks pass, a draft when they don't.

It's built for JavaScript and TypeScript repositories on GitHub (npm, pnpm or yarn), including repos with a separate frontend/ and backend/.

It's free to start: 10 runs a month, no card needed.

👉 Try it on one of your repos: hobai.app

#DeveloperTools #AI #TypeScript #JavaScript #GitHub

---

### 2. Problem → solution

Today, Hobai is live.

Here's the problem I kept running into: a lot of coding tasks are clear before I even start. Add an endpoint. Fix a validation bug. Write the missing tests. I know exactly what should change, and it still takes a couple of hours of my attention.

So I built Hobai. You describe the change; it opens the pull request.

What happens in between:
→ A fresh, isolated cloud sandbox is created for the run
→ Your repo is cloned and installed using a setup Hobai worked out once, with your input only where it was needed
→ Your lint, type-check and tests run first, so there's a baseline
→ The agent reads, edits and runs commands until the task is done
→ The checks run again and are compared with the baseline: fixed, still passing, regressed
→ A pull request lands on its own hobai/ branch, with a summary and the check results

If the checks fail, you get a draft PR, not a green-looking one. If nothing needed changing, there's no PR, just an explanation.

You stay in control of what gets merged. Hobai only proposes changes, never touches your main branch, and the agent never holds a token that can write to your repo.

For JavaScript and TypeScript repos on GitHub. Free to start.

Hand off your next task 👉 hobai.app

#DeveloperTools #AI #SoftwareEngineering #CodeReview

---

### 3. Founder voice: what I'd want from any tool that touches my code

Today, Hobai is live 🎉

Hobai is an autonomous coding agent for your GitHub repositories. You describe the change; it does the work in an isolated sandbox and opens a pull request for you to review.

While building it, I held it to the rules I'd want from any tool that touches my code:

🔒 Your code runs only in sandboxes. Every run gets its own, and it's destroyed when the run ends.
🔑 The agent never holds a token that can write. The commit is made through GitHub's API from outside the sandbox, as a verified commit from hobai[bot].
🌿 Never your main branch. Every change arrives on its own branch, as a pull request.
✅ Checks that really ran. Your lint, type-check and tests run before and after the change, and the results go into the PR.
📝 Honest results. Failing checks mean a draft PR. A run that hits its limit says so in the PR.
⏹️ You can cancel any run at any time.

And setup isn't a config file you have to write. Hobai figures out how to install and check your repo, asks a few multiple-choice questions only if it has to, and verifies everything before saving it.

Right now it supports JavaScript and TypeScript repos on GitHub, and it's free to start.

I'd love for you to try it: hobai.app

#BuildInPublic #DeveloperTools #AI #GitHub

---

### 4. Ask for feedback

Today, Hobai is live, and I'd love your feedback.

Hobai turns a task description into a pull request. Connect a GitHub repo, describe the change, and an agent does the work in its own cloud sandbox while you watch every step live.

Here's a task I use to show it off:
"Add a GET /health endpoint that returns 200 with the database status, and 503 when the database is down. Add tests."

Hobai sets up the repo, runs the existing checks, explores the code, writes the endpoint and the tests, runs them, and opens a PR with a summary, the changed files and a before/after view of your checks.

It works best on well-defined tasks a developer would finish in one to a few hours: a feature or endpoint, a bug fix, tests, a refactor, a dependency update and its fallout. JavaScript and TypeScript, on GitHub.

What I'd really like to hear from you:
• What task did you give it, and would you merge the PR?
• Where did setup get stuck, or ask the wrong question?
• What would you need before trusting it on your team's repo?

It's free to start: 10 runs a month, no card needed. Setting up a repository doesn't use a run.

Try it and tell me what broke 👉 hobai.app

#DeveloperTools #AI #JavaScript #TypeScript #Feedback

---

## X / Twitter

### 1. Single tweet

Today, Hobai is live 🚀

I built an agent that turns a coding task into a pull request. It works in an isolated cloud sandbox, runs your lint, type-check and tests, then opens the PR for you to review.

JS/TS repos on GitHub. Free to start: hobai.app

---

### 2. Single tweet

Hobai is live today.

I wanted an agent that doesn't pretend:
Checks pass → ready PR
Checks fail → draft PR
Nothing to change → no PR, just an explanation

Your checks run before and after every change. Try it free: hobai.app #DevTools

---

### 3. Example-led tweet

Hobai is live. Here's what you can hand it today:

"Add a GET /health endpoint that returns 200 with the DB status, and 503 when the DB is down. Add tests."

It sets up the repo, writes the code, runs the tests and opens a PR on its own branch.

hobai.app

---

### 4. Thread

**1/**
Today, Hobai is live 🚀

I built an autonomous coding agent for your GitHub repos: describe the change, review the pull request.

Here's how it works 🧵

**2/**
1. Connect GitHub. Install the Hobai GitHub App on only the repos you choose.

2. Set up once. Hobai works out how to install and check your repo. If it can't decide, it asks a few multiple-choice questions. Every step it keeps has actually run.

**3/**
3. Describe the task, e.g. "Add a GET /health endpoint that returns 200 with the DB status, 503 when it's down. Add tests."

4. Watch it live: every file it reads, every edit, every command and its output, in its own isolated sandbox.

**4/**
5. Review the PR. Your checks run before and after the change, and the PR gets a summary, the changed files and the check results.

Ready when checks pass, a draft when they don't. Nothing unfinished looks finished.

**5/**
Built to be trusted with your code: never your main branch, access only to the repos you pick, and the agent never holds a token that can write. Cancel any run, any time.

**6/**
For JavaScript and TypeScript repos on GitHub (npm, pnpm, yarn). Free to start, no card needed.

Hand off your next task 👉 hobai.app
