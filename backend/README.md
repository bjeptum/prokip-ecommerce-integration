# Backend Setup Guide

## WooCommerce Connection Setup

To connect WooCommerce stores securely, you need to configure your credentials in a `.env` file.

### Step 1: Create `.env` file

Create a `.env` file in the `backend` folder with the following content:

```env
# WooCommerce API Credentials
WOOCOMMERCE_CONSUMER_KEY=ck_your_consumer_key_here
WOOCOMMERCE_CONSUMER_SECRET=cs_your_consumer_secret_here

# Server Port (optional, defaults to 3000)
PORT=3000
```

### Step 2: Get Your WooCommerce Credentials

1. Log in to your WooCommerce admin dashboard
2. Go to **WooCommerce > Settings > Advanced > REST API**
3. Click **Add Key**
4. Set:
   - **Description**: Prokip Integration
   - **User**: Select an admin user
   - **Permissions**: Read/Write
5. Click **Generate API Key**
6. Copy the **Consumer Key** and **Consumer Secret**
7. Paste them into your `.env` file

### Step 3: Start the Server

```bash
npm run dev
```

### Security Notes

- **Never commit the `.env` file** to version control
- The `.env` file is already in `.gitignore`
- Consumer keys and secrets are stored only on the server
- Users only need to provide their store URL in the interface
- All API authentication happens server-side using environment variables









