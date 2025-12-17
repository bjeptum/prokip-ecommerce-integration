# Prokip E-commerce Integration Prototype

## Project Overview
This repository contains a **fully functional prototype** of the Prokip E-commerce Integration feature.  
It connects **Shopify** and **WooCommerce** stores with **two-way product, sales, and inventory synchronization**.

The prototype is built **exclusively with pure Node.js**, without external dependencies or frameworks.  
It implements all core requirements defined in the PRD and functionality specification.

This project is ready to run locally in minutes and is suitable for demos, internal validation, or as a foundation for production development.


## Features Implemented
- Self-service store connection flow (simulated OAuth, no API keys required)
- Product flow direction selection:
  - Pull products from store → Prokip
  - Push products from Prokip → store
- Product matching and readiness checks with clear user guidance
- Simulated webhook-based real-time sales and inventory synchronization
- Order completion deducts inventory
- Refunds restore inventory
- Sync dashboard with:
  - Current status
  - Manual sync
  - Enable / disable toggle
  - Safe disconnect
- Persistent storage using a local JSON file
- Friendly error handling and user feedback
- Clean, modern, responsive, card-based UI

## Tech Stack
- **Backend / Server**: Pure Node.js  
  - `http`
  - `fs`
  - `url`
  - `querystring`
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Data Storage**: `connections.json`
- **Dependencies**: None

Runs on any standard Node.js installation.


## Folder Structure

prokip-integration/
├── server.js # Main server and routing logic
├── connections.json # Persistent storage (connections, inventory, sales)
├── public/
│ ├── index.html # Integrations dashboard
│ ├── setup.html # Product setup and flow selection
│ └── style.css # Modern professional styling


## Initial Setup and Running the App

### 1. Prerequisites
- Node.js v16 or higher  
  Download: https://nodejs.org

---

### 2. Create the Project
```bash
mkdir prokip-integration
cd prokip-integration
npm init -y