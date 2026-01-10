Project Setup & Execution Guide
Overview

This repository contains a front-end web application developed using HTML, CSS, and JavaScript. At the current stage, the authentication/login flow is not finalized, therefore the application should be executed directly from index.html using a local development server.

Running the project through a local server is required to ensure proper behavior of JavaScript modules and external dependencies (e.g., Firebase).

System Requirements

Visual Studio Code (VS Code) – recommended IDE

A modern web browser (Chrome, Edge, Firefox)

Internet connection (for external libraries / Firebase)

Recommended Method: VS Code + Live Server
1. Install Visual Studio Code

Download and install VS Code from: https://code.visualstudio.com/

2. Install the Live Server Extension

Open Visual Studio Code

Go to the Extensions panel (left sidebar)

Search for Live Server

Install the extension developed by Ritwick Dey

3. Clone and Open the Project

Clone the repository using Git:

git clone <repository-url>

Open the project folder in VS Code:

File → Open Folder → select the cloned project directory

4. Run the Application

Open the file:

index.html

Right-click inside the file

Select "Open with Live Server"

The application will automatically launch in your default browser, for example:

http://127.0.0.1:5500/index.html
Important Notes

❌ Do not open index.html by double-clicking the file

✅ Always run the project via a local server

Required for ES6 modules and Firebase integration

Alternative Execution Methods
Option 1: Python Local Server

If Python is installed:

python -m http.server 5500

Then open:

http://localhost:5500/index.html
Option 2: Node.js HTTP Server

If Node.js is installed:

npm install -g http-server
http-server

Then open:

http://localhost:8080/index.html
Project Status

🚧 Login and authentication are under development

🔓 The project currently starts from index.html

Future versions will include secured routing and authentication logic

Summary

Clone the repository

Open it in VS Code

Install Live Server

Run index.html using a local server
