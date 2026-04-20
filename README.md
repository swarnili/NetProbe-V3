Part 3: The Advanced Analytics & Insight Suite
project 2 : https://github.com/swarnili/VPN-Performance-Evaluator
This project is the final installment of my Network Security portfolio. It is designed to work as the intelligence layer for the previous two modules:

Network-Analyzer-Pro (Project 1): Provided the raw monitoring infrastructure.

VPN-Performance-Evaluator (Project 2): Provided the security and encryption modeling.

NetProbe-V3 (Current): Acts as the Analytical Brain, automating the interpretation of network data and generating professional research insights.

 Project Overview
NetProbe-V3 is a high-fidelity diagnostic platform that bridges the gap between raw data collection and technical decision-making. While Project 2 allowed us to see speed differences, NetProbe-V3 uses a backend Insight Engine to mathematically analyze stability, jitter, and the "security tax" on throughput, providing human-readable conclusions.

 Key Features (Dependencies on Project 2)
Advanced Insight Engine: Automatically interprets results (e.g., "VPN tunneling reduced throughput by X%—this models AES-256 overhead").

Stability Vectoring: Calculates a "Stability Score" (0-100) based on statistical variance, a feature that builds directly on Project 2's comparative modes.

Professional Export Module: Generates downloadable PDF Reports (via jsPDF), JSON, CSV, and TXT files for external research and auditing.

Session Persistence: Includes an experiment history tracker to compare multiple runs over time.

 Technical Stack
Backend: Python (Flask)

Frontend: JavaScript (Chart.js, jsPDF, ES6+), CSS3 (Cyberpunk/Orbitron UI)

Data Science: Statistical variance modeling and throughput degradation analysis.

 How it Connects
P1 (The Eyes): We watch the traffic.

P2 (The Shield): We encrypt the traffic and measure the cost.

P3 (The Brain): We analyze the data and generate the report.